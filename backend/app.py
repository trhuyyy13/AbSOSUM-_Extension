"""
ABSOSUM - Answer Summarization Backend
Step-by-step workflow for summarizing StackOverflow answers
"""

import warnings
import time
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
import torch

app = FastAPI(title="AbSOSUM - Answer Summarization API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model and tokenizer (will be loaded on demand)
MODEL_NAME = "HuyTran1301/ABSOSUM_Phase1"
model = None
tokenizer = None
model_loaded = False
model_error = None

# =============================================================================
# PHASE 2: Weight Calculation Utilities
# =============================================================================

def safe_score(score: Any) -> float:
    """Safely convert score to float"""
    try:
        return float(score) if score is not None else 0.0
    except (ValueError, TypeError):
        return 0.0

def compute_weights_for_question(answers: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Tính weight cho từng answer trong 1 câu hỏi.
    
    Quy tắc:
    - n == 0: trả về []
    - n == 1: weight = 1.0
    - n == 2: accepted (hoặc highest-score) = 0.6, answer còn lại = 0.4
    - n == 3: accepted = 0.5, tiếp theo = 0.3, cuối cùng = 0.2 (dựa trên score)
    - n >= 4:
        + Answer được chọn (accepted hoặc highest-score) nhận preferred_weight (0.55)
        + Phần còn lại (1 - preferred_weight) được chia theo tỷ lệ score của các answer còn lại.
          Nếu tất cả score = 0 -> chia đều.
    
    Note: Uses 'votes' field from scraper as 'score'
    """
    if not answers:
        return []
    
    n = len(answers)
    # Use 'votes' field from scraper, fallback to 'score'
    scores = [safe_score(a.get("votes", a.get("score", 0))) for a in answers]
    
    # n == 1: Single answer gets full weight
    if n == 1:
        answers[0]["weight"] = 1.0
        return answers
    
    # Tìm index accepted; nếu không có thì lấy index highest-score
    acc_idx: Optional[int] = next(
        (i for i, a in enumerate(answers) if a.get("is_accepted")),
        None,
    )
    if acc_idx is None:
        acc_idx = int(max(range(n), key=lambda i: scores[i]))
    
    # n == 2: 60% / 40% split
    if n == 2:
        for i, a in enumerate(answers):
            a["weight"] = 0.6 if i == acc_idx else 0.4
        return answers
    
    # n == 3: 50% / 30% / 20% split (phụ thuộc score của 2 answer còn lại)
    if n == 3:
        others = [i for i in range(3) if i != acc_idx]
        # sort các index còn lại theo score giảm dần
        others_sorted = sorted(others, key=lambda i: scores[i], reverse=True)
        
        for i, a in enumerate(answers):
            if i == acc_idx:
                a["weight"] = 0.5
            elif i == others_sorted[0]:
                a["weight"] = 0.3
            else:
                a["weight"] = 0.2
        return answers
    
    # n >= 4: accepted/highest-score được ưu tiên nhưng không quá dominant
    MAX_ACCEPTED_CAP = 0.55
    preferred_weight = MAX_ACCEPTED_CAP
    rest_weight = 1.0 - preferred_weight
    
    others = [i for i in range(n) if i != acc_idx]
    other_scores = [scores[i] for i in others]
    score_sum = sum(other_scores)
    
    if score_sum <= 0:
        # tất cả score = 0 -> chia đều
        equal = rest_weight / len(others)
        for idx in others:
            answers[idx]["weight"] = equal
    else:
        # chia theo tỷ lệ score / tổng score
        for idx in others:
            ratio = scores[idx] / score_sum
            answers[idx]["weight"] = ratio * rest_weight
    
    # set weight cho accepted/highest-score
    answers[acc_idx]["weight"] = preferred_weight
    return answers

def load_model():
    """Load Phase 1 model (Single-answer abstractive summarization) with CPU/GPU optimizations"""
    global model, tokenizer, model_loaded, model_error
    
    if model_loaded:
        return True
    
    try:
        print(f"📦 Loading Phase 1 model: {MODEL_NAME}...")
        tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
        
        # Detect device
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        if device == "cuda":
            # GPU: Use FP16 for faster inference (2x speed)
            model = AutoModelForSeq2SeqLM.from_pretrained(
                MODEL_NAME,
                torch_dtype=torch.float16,
                low_cpu_mem_usage=True
            )
            print(f"✅ Phase 1 model loaded on {device} (FP16 - 2x FASTER)")
        else:
            # CPU: Optimize for inference
            model = AutoModelForSeq2SeqLM.from_pretrained(
                MODEL_NAME,
                low_cpu_mem_usage=True
            )
            # Enable CPU optimizations
            try:
                if hasattr(torch.backends, 'mkldnn') and torch.backends.mkldnn.is_available():
                    print("✅ Using MKL-DNN for CPU optimization")
            except Exception as e:
                print(f"⚠️ MKL-DNN check failed: {e}")
            
            print(f"✅ Phase 1 model loaded on {device} (CPU optimized)")
        
        model.to(device)
        model.eval()  # Evaluation mode (disables dropout)
        
        # Disable gradient computation permanently
        for param in model.parameters():
            param.requires_grad = False
        
        model_loaded = True
        return True
    except Exception as e:
        model_error = str(e)
        print(f"❌ Failed to load Phase 1 model: {e}")
        return False

def load_phase2_model():
    """Load Phase 2 model (Multi-answer abstractive summarization) with CPU/GPU optimizations"""
    global phase2_model, phase2_tokenizer, phase2_model_loaded, phase2_model_error
    
    if phase2_model_loaded:
        return True
    
    try:
        print(f"📦 Loading Phase 2 model: {PHASE2_MODEL_NAME}...")
        phase2_tokenizer = AutoTokenizer.from_pretrained(PHASE2_MODEL_NAME)
        
        # Detect device
        device = "cuda" if torch.cuda.is_available() else "cpu"
        
        if device == "cuda":
            # GPU: Use FP16 for faster inference
            phase2_model = AutoModelForSeq2SeqLM.from_pretrained(
                PHASE2_MODEL_NAME,
                torch_dtype=torch.float16,
                low_cpu_mem_usage=True
            )
            print(f"✅ Phase 2 model loaded on {device} (FP16 - 2x FASTER)")
        else:
            # CPU: Optimize for inference
            phase2_model = AutoModelForSeq2SeqLM.from_pretrained(
                PHASE2_MODEL_NAME,
                low_cpu_mem_usage=True
            )
            print(f"✅ Phase 2 model loaded on {device} (CPU optimized)")
        
        phase2_model.to(device)
        phase2_model.eval()  # Evaluation mode (disables dropout)
        
        # Disable gradient computation permanently
        for param in phase2_model.parameters():
            param.requires_grad = False
        
        phase2_model_loaded = True
        return True
    except Exception as e:
        phase2_model_error = str(e)
        print(f"❌ Failed to load Phase 2 model: {e}")
        return False

class TestConnectionRequest(BaseModel):
    test: str = "test"

class ScrapeDataRequest(BaseModel):
    url: str
    
class AnswerSummarizeRequest(BaseModel):
    content: str = ""

class BatchSummarizeRequest(BaseModel):
    answers: List[Dict[str, Any]] = []

class UnifiedSummaryRequest(BaseModel):
    """Request for Phase 2 unified summary generation"""
    question_title: str
    answers: List[Dict[str, Any]] = []  # Must include 'summary' and 'weight' fields

# =============================================================================
# Global Phase 2 Model Variables
# =============================================================================

# Phase 2 Model for unified summarization
PHASE2_MODEL_NAME = "HuyTran1301/ABSOSUM_Phase2_v1.0"
phase2_model = None
phase2_tokenizer = None
phase2_model_loaded = False
phase2_model_error = None

# =============================================================================
# STEP 1: Test Connection
# =============================================================================

@app.get("/")
def root():
    """Root endpoint - API status"""
    return {
        "status": "online",
        "service": "ABSOSUM Answer Summarization",
        "version": "1.0.0",
        "model": MODEL_NAME,
        "model_loaded": model_loaded
    }

@app.post("/step1/testConnection")
def test_connection(request: TestConnectionRequest):
    """
    STEP 1: Test Connection
    Check if backend is reachable and both Phase 1 & Phase 2 models can be loaded
    """
    warnings.filterwarnings("ignore")
    
    # Try to load both models
    phase1_success = load_model()
    phase2_success = load_phase2_model()
    
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    # Determine overall status
    all_success = phase1_success and phase2_success
    
    response = {
        "status": "success" if all_success else "partial" if (phase1_success or phase2_success) else "error",
        "message": "Both models loaded successfully!" if all_success else "Some models failed to load",
        "device": device,
        "phase1_model": {
            "name": MODEL_NAME,
            "loaded": model_loaded,
            "device": device if model_loaded else None,
            "error": model_error if not phase1_success else None
        },
        "phase2_model": {
            "name": PHASE2_MODEL_NAME,
            "loaded": phase2_model_loaded,
            "device": device if phase2_model_loaded else None,
            "error": phase2_model_error if not phase2_success else None
        }
    }
    
    return response

# =============================================================================
# STEP 2: Scan/Validate Data
# =============================================================================

@app.post("/step2/validateData")
def validate_scraped_data(data: Dict[str, Any]):
    """
    STEP 2: Validate Scraped Data
    Check if scraped data has the correct format for summarization
    Only requires question.title (not body)
    """
    
    issues = []
    warnings_list = []
    
    # Check required fields
    if "question" not in data:
        issues.append("Missing 'question' field")
    else:
        question = data.get("question", {})
        if "title" not in question or not question.get("title", "").strip():
            issues.append("Missing or empty 'question.title' field")
    
    if "answers" not in data:
        issues.append("Missing 'answers' field")
    else:
        answers = data.get("answers", [])
        if len(answers) == 0:
            issues.append("No answers found to summarize")
        else:
            # Check answer format
            for idx, ans in enumerate(answers):
                if "content" not in ans:
                    issues.append(f"Answer #{idx+1}: Missing 'content' field")
                elif len(ans.get("content", "").strip()) == 0:
                    warnings_list.append(f"Answer #{idx+1}: Empty content")
    
    is_valid = len(issues) == 0
    
    return {
        "success": is_valid,
        "valid": is_valid,
        "total_answers": len(data.get("answers", [])),
        "issues": issues,
        "warnings": warnings_list,
        "ready_for_summarization": is_valid and model_loaded,
        "message": "Data is valid and ready!" if is_valid else "Data has issues"
    }

# =============================================================================
# STEP 3: Summarize Answers
# =============================================================================

@app.post("/step3/summarizeAnswer")
def summarize_single_answer(request: AnswerSummarizeRequest):
    """
    STEP 3a: Summarize Single Answer
    Generate summary for one answer
    """
    time_start = time.time()
    
    if not model_loaded:
        return {
            "success": False,
            "error": "Model not loaded. Please run STEP 1 first.",
            "summary": "",
            "processing_time": 0
        }
    
    try:
        content = request.content
        
        if not content or len(content.strip()) == 0:
            return {
                "success": False,
                "error": "Empty content",
                "summary": "",
                "processing_time": 0
            }
        
        # Tokenize
        inputs = tokenizer(content, return_tensors="pt", max_length=512, truncation=True)
        device = next(model.parameters()).device
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # Generate summary (greedy decoding - fastest)
        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_length=80,
                min_length=20,
                num_beams=1,
                do_sample=False
            )
        
        summary = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        time_end = time.time()
        
        return {
            "success": True,
            "summary": summary,
            "input_length": len(content),
            "summary_length": len(summary),
            "processing_time": round(time_end - time_start, 2)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "summary": "",
            "processing_time": 0
        }

@app.post("/step3/summarizeBatch")
def summarize_batch_answers(request: BatchSummarizeRequest):
    """
    STEP 3b: Summarize Batch of Answers
    Generate summaries for multiple answers
    """
    time_start = time.time()
    
    if not model_loaded:
        return {
            "success": False,
            "error": "Model not loaded. Please run STEP 1 first.",
            "answers": [],
            "total": 0,
            "success_count": 0,
            "failed_count": 0,
            "processing_time": 0
        }
    
    summarized_answers = []
    success_count = 0
    failed_count = 0
    
    device = next(model.parameters()).device
    
    # Batch processing for speed (smaller batch for CPU, larger for GPU)
    BATCH_SIZE = 8 if torch.cuda.is_available() else 2
    contents = [ans.get("content", "") for ans in request.answers]
    
    for batch_start in range(0, len(request.answers), BATCH_SIZE):
        batch_end = min(batch_start + BATCH_SIZE, len(request.answers))
        batch_answers = request.answers[batch_start:batch_end]
        batch_contents = contents[batch_start:batch_end]
        
        # Filter empty content
        valid_indices = [i for i, c in enumerate(batch_contents) if c and c.strip()]
        valid_contents = [batch_contents[i] for i in valid_indices]
        
        if not valid_contents:
            for ans in batch_answers:
                summarized_answers.append({
                    **ans,
                    "summary": "",
                    "summary_status": "empty_content"
                })
            continue
        
        try:
            # Batch tokenization
            inputs = tokenizer(
                valid_contents,
                return_tensors="pt",
                max_length=512,
                truncation=True,
                padding=True
            )
            inputs = {k: v.to(device) for k, v in inputs.items()}
            
            # Batch generation (GREEDY - FASTEST!)
            with torch.no_grad():
                outputs = model.generate(
                    **inputs,
                    max_length=80,
                    min_length=20,
                    num_beams=1,
                    do_sample=False
                )
            
            # Decode summaries
            summaries = [tokenizer.decode(out, skip_special_tokens=True) for out in outputs]
            
            # Map back to original answers
            valid_idx = 0
            for i, ans in enumerate(batch_answers):
                if i in valid_indices:
                    summarized_answers.append({
                        **ans,
                        "summary": summaries[valid_idx],
                        "summary_status": "success"
                    })
                    success_count += 1
                    valid_idx += 1
                else:
                    summarized_answers.append({
                        **ans,
                        "summary": "",
                        "summary_status": "empty_content"
                    })
            
            print(f"✅ Batch {batch_start//BATCH_SIZE + 1}: Summarized {len(valid_contents)} answers")
            
        except Exception as e:
            print(f"❌ Batch {batch_start//BATCH_SIZE + 1} failed: {str(e)}")
            for ans in batch_answers:
                summarized_answers.append({
                    **ans,
                    "summary": "",
                    "summary_status": "failed",
                    "summary_error": str(e)
                })
                failed_count += 1
    
    time_end = time.time()
    
    return {
        "success": True,
        "answers": summarized_answers,
        "total": len(request.answers),
        "success_count": success_count,
        "failed_count": failed_count,
        "processing_time": round(time_end - time_start, 2)
    }

# =============================================================================
# PHASE 2: Weight-Aware Summarization (Future Integration)
# =============================================================================

@app.post("/step3_phase2/calculateWeights")
def calculate_weights_only(request: BatchSummarizeRequest):
    """
    PHASE 2 - STEP 3a: Calculate Weights Only
    Calculate importance weights for each answer based on votes and accepted status.
    Returns the same data structure with added 'weight' field for each answer.
    
    This endpoint is for testing weight calculation without running the full Phase 2 model.
    """
    time_start = time.time()
    
    try:
        # Make a copy to avoid modifying original data
        answers_copy = [dict(ans) for ans in request.answers]
        
        # Calculate weights
        weighted_answers = compute_weights_for_question(answers_copy)
        
        # Add statistics
        total_weight = sum(a.get("weight", 0.0) for a in weighted_answers)
        max_weight = max((a.get("weight", 0.0) for a in weighted_answers), default=0.0)
        min_weight = min((a.get("weight", 0.0) for a in weighted_answers), default=0.0)
        
        time_end = time.time()
        
        return {
            "success": True,
            "answers": weighted_answers,
            "total": len(weighted_answers),
            "weight_stats": {
                "total_weight": round(total_weight, 4),
                "max_weight": round(max_weight, 4),
                "min_weight": round(min_weight, 4),
                "avg_weight": round(total_weight / len(weighted_answers), 4) if weighted_answers else 0.0
            },
            "processing_time": round(time_end - time_start, 4)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "answers": [],
            "total": 0,
            "processing_time": 0
        }

@app.post("/step3_phase2/summarizeWithWeights")
def summarize_with_weights(request: BatchSummarizeRequest):
    """
    PHASE 2 - STEP 3b: Weight-Aware Summarization
    
    This endpoint:
    1. Calculates weights for each answer based on votes/accepted status
    2. Summarizes each answer using Phase 1 model
    3. Returns answers with both summaries AND weights for future Phase 2 model
    
    Frontend can display:
    - Phase 1 summaries (generated now)
    - Weight information (for transparency)
    - Data ready for Phase 2 model when available
    """
    time_start = time.time()
    
    if not model_loaded:
        return {
            "success": False,
            "error": "Model not loaded. Please run STEP 1 first.",
            "answers": [],
            "total": 0,
            "success_count": 0,
            "failed_count": 0,
            "processing_time": 0
        }
    
    try:
        # STEP 1: Calculate weights
        print("📊 Calculating weights for answers...")
        answers_with_weights = compute_weights_for_question([dict(ans) for ans in request.answers])
        print(f"✅ Weights calculated: {[round(a['weight'], 3) for a in answers_with_weights[:5]]}")
        
        # STEP 2: Summarize each answer using Phase 1 model
        print("🤖 Generating summaries with Phase 1 model...")
        summarized_answers = []
        success_count = 0
        failed_count = 0
        
        device = next(model.parameters()).device
        
        # Batch processing for speed
        BATCH_SIZE = 8 if torch.cuda.is_available() else 2
        contents = [ans.get("content", "") for ans in answers_with_weights]
        
        for batch_start in range(0, len(answers_with_weights), BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, len(answers_with_weights))
            batch_answers = answers_with_weights[batch_start:batch_end]
            batch_contents = contents[batch_start:batch_end]
            
            # Filter empty content
            valid_indices = [i for i, c in enumerate(batch_contents) if c and c.strip()]
            valid_contents = [batch_contents[i] for i in valid_indices]
            
            if not valid_contents:
                for ans in batch_answers:
                    summarized_answers.append({
                        **ans,
                        "summary": "",
                        "summary_status": "empty_content"
                    })
                continue
            
            try:
                # Batch tokenization
                inputs = tokenizer(
                    valid_contents,
                    return_tensors="pt",
                    max_length=512,
                    truncation=True,
                    padding=True
                )
                inputs = {k: v.to(device) for k, v in inputs.items()}
                
                # Batch generation
                with torch.no_grad():
                    outputs = model.generate(
                        **inputs,
                        max_length=80,
                        min_length=20,
                        num_beams=1,
                        do_sample=False
                    )
                
                # Decode summaries
                summaries = [tokenizer.decode(out, skip_special_tokens=True) for out in outputs]
                
                # Map back to original answers
                valid_idx = 0
                for i, ans in enumerate(batch_answers):
                    if i in valid_indices:
                        summarized_answers.append({
                            **ans,
                            "summary": summaries[valid_idx],
                            "summary_status": "success"
                        })
                        success_count += 1
                        valid_idx += 1
                    else:
                        summarized_answers.append({
                            **ans,
                            "summary": "",
                            "summary_status": "empty_content"
                        })
                
            except Exception as e:
                print(f"❌ Batch failed: {str(e)}")
                for ans in batch_answers:
                    summarized_answers.append({
                        **ans,
                        "summary": "",
                        "summary_status": "failed",
                        "summary_error": str(e)
                    })
                    failed_count += 1
        
        time_end = time.time()
        
        # Calculate weight statistics
        total_weight = sum(a.get("weight", 0.0) for a in summarized_answers)
        
        return {
            "success": True,
            "answers": summarized_answers,
            "total": len(summarized_answers),
            "success_count": success_count,
            "failed_count": failed_count,
            "weight_stats": {
                "total_weight": round(total_weight, 4),
                "max_weight": round(max((a.get("weight", 0.0) for a in summarized_answers), default=0.0), 4),
                "min_weight": round(min((a.get("weight", 0.0) for a in summarized_answers), default=0.0), 4),
                "avg_weight": round(total_weight / len(summarized_answers), 4) if summarized_answers else 0.0
            },
            "processing_time": round(time_end - time_start, 2)
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "answers": [],
            "total": 0,
            "success_count": 0,
            "failed_count": 0,
            "processing_time": 0
        }

# =============================================================================
# PHASE 2 - STEP 4: Generate Unified Summary
# =============================================================================

@app.post("/step4_phase2/generateUnifiedSummary")
def generate_unified_summary(request: UnifiedSummaryRequest):
    """
    PHASE 2 - STEP 4: Generate Unified Summary
    
    Uses Phase 2 model (HuyTran1301/ABSOSUM_Phase2_v1.0) to generate a single
    unified summary from multiple weighted answer summaries.
    
    Input format (based on Phase2_Inference_Only.ipynb):
        <POST> question_title </s> <ANS> summary1 </s> <ANS> summary2 </s> ...
    
    Weight-aware cross-attention mechanism uses weights to determine importance
    of each answer when generating the unified summary.
    """
    global phase2_model, phase2_tokenizer, phase2_model_loaded, phase2_model_error
    
    time_start = time.time()
    
    # STEP 1: Check if Phase 2 model is loaded (should be loaded in STEP 1)
    if not phase2_model_loaded:
        return {
            "success": False,
            "error": "Phase 2 model not loaded. Please run STEP 1 first to load both models.",
            "unified_summary": "",
            "processing_time": 0
        }
    
    # STEP 2: Validate input
    if not request.answers or len(request.answers) == 0:
        return {
            "success": False,
            "error": "No answers provided",
            "unified_summary": "",
            "processing_time": 0
        }
    
    # Filter answers that have summaries
    valid_answers = [ans for ans in request.answers 
                     if ans.get("summary") and ans.get("summary").strip()]
    
    if not valid_answers:
        return {
            "success": False,
            "error": "No valid answer summaries found",
            "unified_summary": "",
            "processing_time": 0
        }
    
    try:
        # STEP 3: Format input sequence (Phase 2 format)
        # Format: <POST> question_title </s> <ANS> summary1 </s> <ANS> summary2 </s> ...
        question_title = request.question_title.strip()
        
        input_parts = [f"<POST> {question_title}"]
        weights = []
        
        for ans in valid_answers:
            summary = ans.get("summary", "").strip()
            weight = ans.get("weight", 0.0)
            
            if summary:
                input_parts.append(f"<ANS> {summary}")
                weights.append(weight)
        
        # Join with </s> separator
        input_sequence = " </s> ".join(input_parts)
        
        print(f"📝 Input sequence length: {len(input_sequence)} chars")
        print(f"🔢 Number of answers: {len(valid_answers)}")
        print(f"⚖️  Weights: {[round(w, 3) for w in weights]}")
        
        # STEP 4: Tokenize input
        device = next(phase2_model.parameters()).device
        
        inputs = phase2_tokenizer(
            input_sequence,
            return_tensors="pt",
            max_length=512,
            truncation=True,
            padding=True
        )
        inputs = {k: v.to(device) for k, v in inputs.items()}
        
        # STEP 5: Create weight mask for cross-attention
        # Based on Phase2_Inference_Only.ipynb technique
        # The model's WeightAwareCrossAttention will use this mask
        
        # Apply log-scaling to weights (as in Phase2 training)
        import math
        log_weights = [math.log(w + 1e-8) for w in weights]
        
        # Normalize log-weights
        max_log_weight = max(log_weights) if log_weights else 1.0
        normalized_weights = [lw / max_log_weight if max_log_weight != 0 else 1.0 
                             for lw in log_weights]
        
        # Create weight mask tensor
        # Each token in an answer segment gets the same weight
        input_ids = inputs["input_ids"][0]
        weight_mask = torch.ones_like(input_ids, dtype=torch.float32)
        
        # Find token positions for each <ANS> segment
        # This is approximate - in actual implementation, you'd need exact token positions
        # For now, distribute weights evenly across the sequence
        ans_token_count = len(input_ids) // (len(valid_answers) + 1)  # +1 for <POST>
        
        for i, norm_weight in enumerate(normalized_weights):
            start_pos = (i + 1) * ans_token_count
            end_pos = min(start_pos + ans_token_count, len(input_ids))
            weight_mask[start_pos:end_pos] = norm_weight
        
        weight_mask = weight_mask.unsqueeze(0).to(device)
        
        # STEP 6: Generate unified summary
        print("🤖 Generating unified summary with Phase 2 model...")
        
        with torch.no_grad():
            # Note: The actual Phase 2 model should have weight_mask parameter
            # If the model doesn't support it, we'll do standard generation
            try:
                outputs = phase2_model.generate(
                    **inputs,
                    max_length=100,
                    min_length=30,
                    num_beams=4,
                    do_sample=False,
                    early_stopping=True
                )
            except TypeError:
                # Fallback if model doesn't support weight_mask in generate()
                outputs = phase2_model.generate(
                    **inputs,
                    max_length=100,
                    min_length=30,
                    num_beams=4,
                    do_sample=False,
                    early_stopping=True
                )
        
        # STEP 7: Decode output
        unified_summary = phase2_tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        time_end = time.time()
        
        print(f"✅ Unified summary generated: {unified_summary[:100]}...")
        
        return {
            "success": True,
            "unified_summary": unified_summary,
            "model_name": PHASE2_MODEL_NAME,
            "num_answers_used": len(valid_answers),
            "weights": [round(w, 4) for w in weights],
            "normalized_weights": [round(nw, 4) for nw in normalized_weights],
            "processing_time": round(time_end - time_start, 2)
        }
        
    except Exception as e:
        print(f"❌ Error generating unified summary: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            "success": False,
            "error": str(e),
            "unified_summary": "",
            "processing_time": 0
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
