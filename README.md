# PulseCheck
Getting the pulse of customer feedback. Using Cloudflare Workflows and Workers AI, a Workers-powered dashboard provides instant visibility into what customers are saying, transforming hours of manual triage into seconds of automated insight.

🔗 **Live Demo:** [https://damp-sunset-0d05.ap2555.workers.dev](https://damp-sunset-0d05.ap2555.workers.dev)

## 🎯 Overview

PulseCheck is a feedback aggregation tool built for Product Managers to automatically analyze and categorize customer feedback from multiple sources (Discord, GitHub, Support Tickets, Twitter, Email, etc.). 

### Key Features
- 🤖 **AI-Powered Analysis** - Automatic sentiment, category, and urgency detection
- ⚡ **Real-time Processing** - Workflows orchestrate multi-step analysis pipeline
- 📊 **Live Dashboard** - Instant visibility into feedback trends and statistics
- 🗄️ **Persistent Storage** - All feedback stored in D1 for historical analysis

---

## 🏗️ Architecture

Built entirely on the **Cloudflare Developer Platform**:

1. **Cloudflare Workers** - HTTP handling and application logic
2. **Cloudflare Workflows** - Stateful multi-step processing pipeline
3. **Workers AI** - Sentiment analysis and categorization using Llama 3
4. **D1 Database** - Serverless SQL database for feedback storage

### Data Flow
```
Feedback Submission → Workflow Trigger → AI Analysis → D1 Storage → Dashboard Display
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- Cloudflare account (free tier works)
- Wrangler CLI

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/ap2555-dot/PulseCheck.git
cd PulseCheck-main/damp-sunset-0d05
```

2. **Install dependencies**
```bash
npm install
```

3. **Login to Cloudflare**
```bash
npx wrangler login
```

4. **Create D1 Database**
```bash
npx wrangler d1 create damp-db
```

Copy the `database_id` from the output and update it in `wrangler.jsonc`:
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "damp-db",
    "database_id": "YOUR-DATABASE-ID-HERE"
  }
]
```

5. **Initialize Database Schema**
```bash
npx wrangler d1 execute damp-db --remote --file=./schema.sql
npx wrangler d1 execute damp-db --local --file=./schema.sql
```

6. **Run Locally**
```bash
npx wrangler dev
```

7. **Deploy to Cloudflare**
```bash
npx wrangler deploy
```

---

## 📁 Project Structure
```
damp-sunset-0d05/
├── src/
│   └── index.ts          # Main Worker code (API routes, workflow, dashboard)
├── schema.sql            # Database schema
├── wrangler.jsonc        # Cloudflare configuration
├── package.json
└── README.md
```

---

## 🔌 API Endpoints

### `POST /api/feedback`
Submit new feedback for analysis

**Request Body:**
```json
{
  "source": "Discord",
  "content": "The dashboard is loading really slow"
}
```

**Response:**
```json
{
  "success": true,
  "workflowId": "b4b104b4-285a-48c5-b1ce-7d351dca95ce"
}
```

### `GET /api/feedback`
Get all recent feedback (last 50)

### `GET /api/stats`
Get aggregated statistics (by category, sentiment, urgency)

### `GET /`
Dashboard interface

---

## 🧪 Testing

### Sample Feedback Data

You can add sample data for testing:
```bash
npx wrangler d1 execute damp-db --remote --file=./seed.sql
```

Or use the dashboard to submit feedback manually.

---

## 🛠️ Configuration

### Environment Bindings

The Worker uses the following bindings (configured in `wrangler.jsonc`):

- **MY_WORKFLOW** - Workflow binding for feedback processing
- **DB** - D1 Database binding
- **AI** - Workers AI binding for Llama 3 model

---

## 📊 Database Schema

### `feedback` table
```sql
- id (INTEGER, PRIMARY KEY)
- source (TEXT) - Where feedback came from
- content (TEXT) - Feedback content
- sentiment (TEXT) - positive/neutral/negative
- category (TEXT) - bug/feature/question/complaint
- urgency (TEXT) - low/medium/high
- created_at (DATETIME)
```

### `aggregated_stats` table
```sql
- id (INTEGER, PRIMARY KEY)
- stat_type (TEXT)
- stat_value (TEXT)
- updated_at (DATETIME)
```

---

## 🤖 AI Analysis

The workflow uses **Workers AI** with the `@cf/meta/llama-3-8b-instruct` model to analyze each piece of feedback and extract:

- **Sentiment**: positive, neutral, or negative
- **Category**: bug, feature, question, or complaint  
- **Urgency**: low, medium, or high
- **Reason**: Brief explanation of the analysis

---

## 🎨 Features Roadmap

Potential enhancements:
- [ ] Slack/Discord notifications for high-urgency feedback
- [ ] Duplicate detection using semantic search
- [ ] Export reports to PDF/CSV
- [ ] Multi-user authentication
- [ ] Custom categorization rules
- [ ] Trend analysis over time

---

## 📝 License

This project was created as part of the Cloudflare Product Manager Intern Assignment (2026).

---

## 🙏 Acknowledgments

Built using:
- Cloudflare Workers Platform
- Workers AI (Llama 3)
- Cloudflare Workflows
- D1 Database
- With the help of Claude and Gemini

---

## 📧 Contact

Created by Amritha Parimala - ap2555@cornell.edu
