# 📊 AbSOSUM - StackOverflow Answer Summarization

**AbSOSUM** (Abstractive Stack Overflow Summarization) is a Chrome extension that automatically generates abstractive summaries for StackOverflow answers using advanced deep learning models with weight-aware attention mechanisms.

> **Paper**: *A Dataset and Approach for Abstractive Summarization of Stack Overflow Discussions*

## 🚀 Quick Start (30 Seconds)

### Method 1: Docker (Recommended)
```bash
# 1. Clone and start backend
git clone https://github.com/trhuyyy13/AbSOSUM-_Extension.git
cd AbSOSUM-_Extension/backend
docker-compose up --build
# Wait for: ✅ Both models loaded successfully

# 2. Install Chrome Extension
# Open chrome://extensions/ → Enable Developer mode → Load unpacked → Select plugin/ folder

# 3. Test it!
# Go to any StackOverflow question → Click AbSOSUM icon → Follow 4 steps
```

### Method 2: Without Docker
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Then install extension: `chrome://extensions/` → Load unpacked → Select `plugin/` folder

## 🌟 Features

### Phase 1: Single-answer abstractive summarization
- Generate individual summaries for each answer
- Calculate importance weights based on vote scores
- Highlight accepted answers
- Export results to JSON

### Phase 2: Multi-answer abstractive summarization
- Generate unified summary from multiple answers
- Weight-aware cross-attention mechanism
- Combine information from all answers intelligently
- Produce single comprehensive summary

### Additional Features
- **Multi-page scraping**: Automatically scrape all pages of answers
- **Chrome Extension**: Seamless integration with StackOverflow
- **Docker Support**: Easy deployment with containerization
- **Real-time Processing**: Fast summarization with GPU/CPU support
- **Export Options**: Download results as JSON

## 🎯 Demo

- Video YTB update later.
- Slide demo: https://drive.google.com/file/d/1rc9T9FDxnwPDFOKZuVXrT1T3fwup9iPJ/view?usp=sharing

## 📁 Project Structure

```
AbSOSUM/
├── backend/                    # FastAPI backend service
│   ├── app.py                  # Main application with Phase 1 & 2 models
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Docker configuration
│   └── docker-compose.yml      # Docker Compose setup
├── plugin/                     # Chrome extension
│   ├── manifest.json           # Extension manifest
│   ├── popup.html              # Extension popup interface
│   ├── popup.js                # Popup functionality
│   ├── scraper.js              # Content script (4-step workflow)
│   ├── background.js           # Service worker
│   ├── styles.css              # Extension styling
│   └── images/                 # Extension icons
└── README.md                   # This file
```

## 🚀 Installation & Setup

### Prerequisites

- **Python 3.11+** (for backend)
- **Google Chrome** browser
- **Docker** (optional, recommended for easy deployment)
- **CUDA-capable GPU** (optional, for faster inference)

---

## Method 1: Docker Deployment (⭐ Recommended)

### Step 1: Clone the Repository

```bash
git clone https://github.com/trhuyyy13/AbSOSUM-_Extension.git
cd AbSOSUM-_Extension
```

### Step 2: Start Backend with Docker

```bash
cd backend
docker-compose up --build
```

**Expected output:**
```
✅ Phase 1 model loaded: HuyTran1301/AbSOSUM_Phase1
✅ Phase 2 model loaded: HuyTran1301/AbSOSUM_Phase2_v1.0
INFO: Uvicorn running on http://0.0.0.0:8000
```

### Step 3: Load Chrome Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the `plugin/` folder from the project directory
5. Extension icon should appear in your toolbar

✅ **Installation Complete!** Backend is running on `http://localhost:8000`

---

## Method 2: Manual Setup

### Backend Setup

#### 1. Navigate to backend directory
```bash
cd backend
```

#### 2. Create virtual environment
```bash
# Windows
python -m venv .venv
.venv\Scripts\activate

# Linux/Mac
python3 -m venv .venv
source .venv/bin/activate
```

#### 3. Install dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### 4. Run the backend
```bash
python app.py
```

Or with uvicorn:
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

**Expected output:**
```
INFO: Loading Phase 1 model: HuyTran1301/AbSOSUM_Phase1
INFO: Loading Phase 2 model: HuyTran1301/AbSOSUM_Phase2_v1.0
INFO: Models loaded on: cuda / cpu
INFO: Uvicorn running on http://0.0.0.0:8000
```

### Chrome Extension Setup

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → Select `plugin/` folder
4. ✅ Extension installed!

---

## 📖 Usage Guide

### Step-by-Step Workflow

#### 1️⃣ Navigate to StackOverflow
- Open any StackOverflow question with multiple answers
- Example: https://stackoverflow.com/questions/927358

#### 2️⃣ Open AbSOSUM Extension
- Click the AbSOSUM icon in Chrome toolbar
- Or press `Alt+Shift+A` (keyboard shortcut)

#### 3️⃣ STEP 1: Test Backend Connection
- Click **"Load Model & Test Connection"**
- Wait for models to load (first time may take 1-2 minutes)
- ✅ Both Phase 1 and Phase 2 models should load successfully

#### 4️⃣ STEP 2: Scrape StackOverflow Data
- Click **"Scrape Current Page"**
- Extension will scrape ALL pages of answers automatically
- Shows: Question title, total answers, votes, accepted answers

#### 5️⃣ STEP 3: Phase 1 - Individual Summaries
- Click **"Summarize + Calculate Weights"**
- Each answer gets:
  - Individual summary (Phase 1 model)
  - Importance weight (based on votes)
- View detailed results with **"View Full Details"** button
- Download data with **"Download JSON"** button

#### 6️⃣ STEP 4: Phase 2 - Unified Summary
- Click **"Generate Unified Summary (Phase 2)"**
- Phase 2 model combines all individual summaries
- Uses weight-aware cross-attention
- Produces single comprehensive answer
- Download complete results with **"Download Complete JSON"**

---

## 🔧 API Documentation

### Backend Endpoints

#### 1. Test Connection & Load Models
```http
POST /step1/testConnection
Content-Type: application/json

{
  "test": "test"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Both models loaded successfully",
  "device": "cuda",
  "phase1_model": {
    "name": "HuyTran1301/AbSOSUM_Phase1",
    "loaded": true,
    "device": "cuda:0"
  },
  "phase2_model": {
    "name": "HuyTran1301/AbSOSUM_Phase2_v1.0",
    "loaded": true,
    "device": "cuda:0"
  }
}
```

#### 2. Validate Scraped Data
```http
POST /step2/validateData
Content-Type: application/json

{
  "question": {
    "title": "How to sort a list in Python?"
  },
  "answers": [
    {
      "id": "answer-12345",
      "votes": 150,
      "is_accepted": true,
      "content": "You can use the sorted() function...",
      "content_length": 250
    }
  ]
}
```

#### 3. Generate Individual Summaries + Weights (Phase 1)
```http
POST /step3_phase2/summarizeWithWeights
Content-Type: application/json

{
  "question": {
    "title": "How to sort a list in Python?"
  },
  "answers": [
    {
      "id": "answer-12345",
      "votes": 150,
      "is_accepted": true,
      "content": "You can use the sorted() function or list.sort() method...",
      "content_length": 250
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "answers": [
    {
      "id": "answer-12345",
      "votes": 150,
      "is_accepted": true,
      "weight": 1.0,
      "summary": "Use sorted() function for new sorted list or list.sort() for in-place sorting.",
      "content": "Original content..."
    }
  ],
  "total": 1,
  "success_count": 1,
  "failed_count": 0,
  "processing_time": 2.45,
  "weight_stats": {
    "total_weight": 1.0,
    "min_weight": 1.0,
    "max_weight": 1.0,
    "avg_weight": "1.000"
  }
}
```

#### 4. Generate Unified Summary (Phase 2)
```http
POST /step4_phase2/generateUnifiedSummary
Content-Type: application/json

{
  "question_title": "How to sort a list in Python?",
  "answers": [
    {
      "id": "answer-12345",
      "votes": 150,
      "weight": 0.6,
      "summary": "Use sorted() function for new list."
    },
    {
      "id": "answer-67890",
      "votes": 80,
      "weight": 0.4,
      "summary": "Use list.sort() for in-place sorting."
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "unified_summary": "To sort a list in Python, use the sorted() function to create a new sorted list, or use the list.sort() method for in-place sorting. Both methods support key and reverse parameters for custom sorting.",
  "model_name": "HuyTran1301/AbSOSUM_Phase2_v1.0",
  "processing_time": 3.12
}
```

---

## ⚙️ Configuration

### Weight Calculation Algorithm

Weights are calculated based on vote scores:

- **n = 1 answer**: `weight = 1.0`
- **n = 2 answers**: `weights = [0.6, 0.4]`
- **n = 3 answers**: `weights = [0.5, 0.3, 0.2]`
- **n ≥ 4 answers**: 
  - Accepted answer: `0.55`
  - Remaining: Distributed proportionally based on votes

### Model Information

| Phase | Model | Purpose | Input Format |
|-------|-------|---------|--------------|
| Phase 1 | `HuyTran1301/AbSOSUM_Phase1` | Single-answer summarization | `<POST> question_title </s> <ANS> answer_text </s>` |
| Phase 2 | `HuyTran1301/AbSOSUM_Phase2_v1.0` | Multi-answer unified summary | `<POST> question_title </s> <ANS> summary1 </s> <ANS> summary2 </s>` |

---

## 🐳 Docker Commands

### Basic Operations
```bash
# Build and start
docker-compose up --build

# Run in background
docker-compose up -d --build

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Custom Port Configuration
If port 8000 is in use, modify `docker-compose.yml`:
```yaml
services:
  backend:
    ports:
      - "8001:8000"  # Change 8001 to your preferred port
```

Then update extension: Open `plugin/scraper.js` and change:
```javascript
const API_BASE_URL = 'http://127.0.0.1:8001';  // Update port
```

---

## 🛠️ Troubleshooting

### Backend Issues

#### ❌ Port 8000 already in use
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :8000
kill -9 <PID>
```

#### ❌ Models not loading / CUDA out of memory
```python
# Edit backend/app.py
# Change line ~35 to force CPU:
device = torch.device("cpu")
```

#### ❌ Dependencies not installing
```bash
pip install --upgrade pip
pip cache purge
pip install -r requirements.txt --no-cache-dir
```

### Extension Issues

#### ❌ Extension not working
1. Open Chrome DevTools (F12)
2. Check Console tab for errors
3. Verify backend is running: Open `http://localhost:8000/docs`
4. Reload extension: `chrome://extensions/` → Click reload icon

#### ❌ "Connection failed" in STEP 1
1. Check backend is running on `http://localhost:8000`
2. Check CORS errors in browser console
3. Verify no firewall blocking localhost

#### ❌ "View Full Details" button not working
1. Open Chrome DevTools Console (F12)
2. Look for debug logs with emojis (🔍, ✅, 👁️)
3. Reload extension and try again

### Docker Issues

#### ❌ Container won't start
```bash
# Check logs
docker-compose logs backend

# Check if port is available
docker ps

# Rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up
```

#### ❌ Permission denied errors
```bash
# Linux/Mac
sudo chown -R $USER:$USER .
chmod -R 755 .
```

---

## 🧪 Testing

### Test Backend Connection
```bash
curl -X POST http://localhost:8000/step1/testConnection \
  -H "Content-Type: application/json" \
  -d '{"test":"test"}'
```

### Test Phase 1 Summarization
```bash
curl -X POST http://localhost:8000/step3_phase2/summarizeWithWeights \
  -H "Content-Type: application/json" \
  -d '{
    "question": {"title": "Test question"},
    "answers": [{
      "id": "1",
      "votes": 10,
      "is_accepted": true,
      "content": "This is a test answer with some content.",
      "content_length": 40
    }]
  }'
```

---

## 📊 System Requirements

### Minimum Requirements
- **CPU**: 4 cores
- **RAM**: 8GB
- **Storage**: 5GB free space
- **Internet**: Stable connection (for model download on first run)

### Recommended Requirements
- **CPU**: 8+ cores
- **RAM**: 16GB+
- **GPU**: NVIDIA GPU with 6GB+ VRAM (for faster inference)
- **Storage**: 10GB+ free space

### Model Sizes
- Phase 1 Model: ~1.2GB
- Phase 2 Model: ~1.2GB
- Total: ~2.4GB (downloaded automatically on first run)

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👥 Authors

- **Tran Huy** - Initial work - [HuyTran1301](https://huggingface.co/HuyTran1301)

---

## 🙏 Acknowledgments

- StackOverflow for providing the platform and data
- Hugging Face for model hosting and transformers library
- FastAPI for the excellent web framework
- Chrome Extensions team for the development platform

---

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Troubleshooting](#-troubleshooting) section
2. Open an issue on GitHub
3. Check existing issues for solutions

---

## 🎓 Citation

If you use this work in your research, please cite:

```bibtex
@article{absosum2024,
  title={A Dataset and Approach for Abstractive Summarization of Stack Overflow Discussions},
  author={Tran, Huy and others},
  year={2024},
  publisher={GitHub},
  howpublished={\url{https://github.com/trhuyyy13/AbSOSUM-_Extension}}
}
```

---

## 📝 Changelog

### Version 2.0.0 (Phase 2)
- ✅ Added Phase 2 multi-answer summarization
- ✅ Implemented weight-aware cross-attention
- ✅ Added unified summary generation
- ✅ Improved UI with 4-step workflow
- ✅ Enhanced modal displays
- ✅ Added JSON export functionality

### Version 1.0.0 (Phase 1)
- ✅ Initial release
- ✅ Single-answer summarization
- ✅ Chrome extension
- ✅ Docker support
- ✅ Multi-page scraping

---

**Made with ❤️ by the AbSOSUM Team**
#   A b S O S U M - _ E x t e n s i o n 
 
 