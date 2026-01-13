import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

// Define the Workflow
export class MyWorkflow extends WorkflowEntrypoint {
  async run(event: WorkflowEvent<FeedbackInput>, step: WorkflowStep) {
    const { source, content } = event.payload;

    // Step 1: Analyze with AI
    const analysis = await step.do('analyze-feedback', async () => {
      const messages = [
        {
          role: 'system',
          content: 'You are a feedback analyzer. Analyze the following feedback and respond with JSON only containing: sentiment (positive/neutral/negative), category (bug/feature/question/complaint), urgency (low/medium/high), and a brief reason.'
        },
        {
          role: 'user',
          content: `Source: ${source}\nFeedback: ${content}`
        }
      ];

      const response = await this.env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages,
      });

      // Parse AI response
      try {
        const result = JSON.parse(response.response);
        return result;
      } catch {
        // Fallback if AI doesn't return valid JSON
        return {
          sentiment: 'neutral',
          category: 'unknown',
          urgency: 'low',
          reason: 'Could not parse AI response'
        };
      }
    });

    // Step 2: Store in D1
    await step.do('store-feedback', async () => {
      await this.env.DB.prepare(
        'INSERT INTO feedback (source, content, sentiment, category, urgency) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(source, content, analysis.sentiment, analysis.category, analysis.urgency)
        .run();
    });

    // Step 3: Update aggregated stats
    await step.do('update-stats', async () => {
      // Count by category
      const categoryCount = await this.env.DB.prepare(
        'SELECT COUNT(*) as count FROM feedback WHERE category = ?'
      )
        .bind(analysis.category)
        .first();

      // Store or update stat
      await this.env.DB.prepare(
        'INSERT OR REPLACE INTO aggregated_stats (id, stat_type, stat_value) VALUES ((SELECT id FROM aggregated_stats WHERE stat_type = ?), ?, ?)'
      )
        .bind(`category_${analysis.category}`, `category_${analysis.category}`, JSON.stringify(categoryCount))
        .run();
    });

    // Step 4: Check for urgent issues
    const alert = await step.do('check-urgency', async () => {
      if (analysis.urgency === 'high') {
        return {
          alert: true,
          message: `🚨 High urgency ${analysis.category} detected from ${source}`,
          content: content.substring(0, 100)
        };
      }
      return { alert: false };
    });

    return {
      success: true,
      analysis,
      alert
    };
  }
}

// Define types
interface FeedbackInput {
  source: string;
  content: string;
}

interface Env {
  DB: D1Database;
  AI: any;
  MY_WORKFLOW: Workflow;
}

// Main Worker - handles HTTP requests
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Route: Submit feedback
    if (url.pathname === '/api/feedback' && request.method === 'POST') {
      try {
        const body = await request.json() as FeedbackInput;
        
        // Trigger the workflow
        const instance = await env.MY_WORKFLOW.create({
          params: body
        });

        return Response.json({
          success: true,
          workflowId: instance.id
        }, { headers: corsHeaders });
      } catch (error) {
        return Response.json({
          error: 'Invalid request body'
        }, { status: 400, headers: corsHeaders });
      }
    }

    // Route: Get all feedback
    if (url.pathname === '/api/feedback' && request.method === 'GET') {
      const results = await env.DB.prepare(
        'SELECT * FROM feedback ORDER BY created_at DESC LIMIT 50'
      ).all();

      return Response.json(results.results, { headers: corsHeaders });
    }

    // Route: Get stats
    if (url.pathname === '/api/stats' && request.method === 'GET') {
      const categories = await env.DB.prepare(
        'SELECT category, COUNT(*) as count FROM feedback GROUP BY category'
      ).all();

      const sentiments = await env.DB.prepare(
        'SELECT sentiment, COUNT(*) as count FROM feedback GROUP BY sentiment'
      ).all();

      const urgency = await env.DB.prepare(
        'SELECT urgency, COUNT(*) as count FROM feedback GROUP BY urgency'
      ).all();

      return Response.json({
        categories: categories.results,
        sentiments: sentiments.results,
        urgency: urgency.results
      }, { headers: corsHeaders });
    }

    // Route: Simple dashboard HTML
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(getDashboardHTML(), {
        headers: { 'Content-Type': 'text/html', ...corsHeaders }
      });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

// Simple HTML Dashboard
function getDashboardHTML() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Feedback Pipeline Dashboard</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; 
      max-width: 1200px; 
      margin: 0 auto; 
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; }
    .container { 
      display: grid; 
      grid-template-columns: 1fr 1fr; 
      gap: 20px; 
      margin-top: 20px; 
    }
    .card { 
      background: white;
      border: 1px solid #ddd; 
      padding: 20px; 
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    input, textarea, select { 
      width: 100%; 
      padding: 10px; 
      margin: 5px 0; 
      box-sizing: border-box;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-family: inherit;
    }
    button { 
      background: #f6821f; 
      color: white; 
      padding: 12px 24px; 
      border: none; 
      border-radius: 4px; 
      cursor: pointer;
      font-size: 16px;
      margin-top: 10px;
    }
    button:hover { 
      background: #e07317; 
    }
    .feedback-item { 
      border-bottom: 1px solid #eee; 
      padding: 12px 0; 
    }
    .feedback-item:last-child {
      border-bottom: none;
    }
    .stat { 
      display: flex; 
      justify-content: space-between; 
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .stat:last-child {
      border-bottom: none;
    }
    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 3px;
      font-size: 12px;
      font-weight: bold;
    }
    .badge-high { background: #fee; color: #c00; }
    .badge-medium { background: #ffeaa7; color: #d63031; }
    .badge-low { background: #dfe6e9; color: #2d3436; }
    .badge-positive { background: #d4edda; color: #155724; }
    .badge-negative { background: #f8d7da; color: #721c24; }
    .badge-neutral { background: #e2e3e5; color: #383d41; }
    #submit-status {
      margin-top: 10px;
      padding: 8px;
      border-radius: 4px;
    }
    .success { background: #d4edda; color: #155724; }
    .error { background: #f8d7da; color: #721c24; }
    h2 { margin-top: 0; color: #444; }
    h3 { 
      color: #666; 
      font-size: 14px; 
      text-transform: uppercase;
      margin: 15px 0 8px 0;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <h1>📊 Feedback Pipeline Dashboard</h1>
  <p style="color: #666;">Resources used - Cloudflare Workers + Workflows + AI + D1</p>
  
  <div class="container">
    <div class="card">
      <h2>Submit Feedback</h2>
      <label><strong>Source:</strong></label>
      <select id="source">
        <option>Discord</option>
        <option>GitHub</option>
        <option>Support Ticket</option>
        <option>Twitter</option>
        <option>Email</option>
        <option>Community Forum</option>
      </select>
      
      <label><strong>Feedback Content:</strong></label>
      <textarea id="content" rows="5" placeholder="Enter customer feedback here..."></textarea>
      
      <button onclick="submitFeedback()">Submit & Analyze with AI!</button>
      <div id="submit-status"></div>
    </div>
    
    <div class="card">
      <h2>📈 Statistics</h2>
      <div id="stats">Loading...</div>
    </div>
  </div>
  
  <div class="card" style="margin-top: 20px;">
    <h2>💬 Recent Feedback</h2>
    <div id="feedback-list">Loading...</div>
  </div>

  <script>
    async function submitFeedback() {
      const source = document.getElementById('source').value;
      const content = document.getElementById('content').value;
      
      if (!content.trim()) {
        alert('Please enter feedback content');
        return;
      }
      
      const statusDiv = document.getElementById('submit-status');
      statusDiv.textContent = '⏳ Submitting and analyzing with AI...';
      statusDiv.className = '';
      
      try {
        const response = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source, content })
        });
        
        const result = await response.json();
        statusDiv.textContent = '✅ Submitted! Workflow ID: ' + result.workflowId;
        statusDiv.className = 'success';
        document.getElementById('content').value = '';
        
        // Refresh data after 2 seconds to allow workflow to complete
        setTimeout(() => {
          loadFeedback();
          loadStats();
        }, 2000);
      } catch (error) {
        statusDiv.textContent = '❌ Error: ' + error.message;
        statusDiv.className = 'error';
      }
    }
    
    async function loadStats() {
      try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        
        let html = '';
        
        if (stats.categories && stats.categories.length > 0) {
          html += '<h3>By Category</h3>';
          stats.categories.forEach(c => {
            html += \`<div class="stat"><span>\${c.category || 'unknown'}</span><strong>\${c.count}</strong></div>\`;
          });
        }
        
        if (stats.sentiments && stats.sentiments.length > 0) {
          html += '<h3>By Sentiment</h3>';
          stats.sentiments.forEach(s => {
            html += \`<div class="stat"><span>\${s.sentiment || 'unknown'}</span><strong>\${s.count}</strong></div>\`;
          });
        }
        
        if (stats.urgency && stats.urgency.length > 0) {
          html += '<h3>By Urgency</h3>';
          stats.urgency.forEach(u => {
            html += \`<div class="stat"><span>\${u.urgency || 'unknown'}</span><strong>\${u.count}</strong></div>\`;
          });
        }
        
        if (!html) {
          html = '<p style="color: #999;">No statistics yet. Submit some feedback to get started!</p>';
        }
        
        document.getElementById('stats').innerHTML = html;
      } catch (error) {
        document.getElementById('stats').innerHTML = '<p style="color: #c00;">Error loading stats</p>';
      }
    }
    
    async function loadFeedback() {
      try {
        const response = await fetch('/api/feedback');
        const feedback = await response.json();
        
        if (!feedback || feedback.length === 0) {
          document.getElementById('feedback-list').innerHTML = '<p style="color: #999;">No feedback yet. Submit your first piece of feedback above!</p>';
          return;
        }
        
        let html = '';
        feedback.forEach(f => {
          const urgencyClass = f.urgency === 'high' ? 'badge-high' : f.urgency === 'medium' ? 'badge-medium' : 'badge-low';
          const sentimentClass = f.sentiment === 'positive' ? 'badge-positive' : f.sentiment === 'negative' ? 'badge-negative' : 'badge-neutral';
          
          html += \`
            <div class="feedback-item">
              <div style="margin-bottom: 8px;">
                <strong>\${f.source}</strong> 
                <span class="badge \${urgencyClass}">\${f.urgency || 'unknown'}</span>
                <span class="badge \${sentimentClass}">\${f.sentiment || 'unknown'}</span>
                <em style="color: #666;">· \${f.category || 'unknown'}</em>
              </div>
              <div style="color: #444;">\${f.content.substring(0, 200)}\${f.content.length > 200 ? '...' : ''}</div>
              <div style="font-size: 12px; color: #999; margin-top: 4px;">\${new Date(f.created_at).toLocaleString()}</div>
            </div>
          \`;
        });
        
        document.getElementById('feedback-list').innerHTML = html;
      } catch (error) {
        document.getElementById('feedback-list').innerHTML = '<p style="color: #c00;">Error loading feedback</p>';
      }
    }
    
    // Load data on page load
    loadStats();
    loadFeedback();
    
    // Refresh every 10 seconds
    setInterval(() => {
      loadStats();
      loadFeedback();
    }, 10000);
  </script>
</body>
</html>
  `;
}