'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ApiDocsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('getting-started');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ code, language, id }: { code: string; language: string; id: string }) => (
    <div className="relative">
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <span className="text-xs text-gray-400 uppercase">{language}</span>
        <button
          onClick={() => copyToClipboard(code, id)}
          className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-white rounded transition"
        >
          {copiedCode === id ? '✓ Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
        <code className="text-sm">{code}</code>
      </pre>
    </div>
  );

  const EndpointSection = ({ 
    method, 
    endpoint, 
    description, 
    children 
  }: { 
    method: string; 
    endpoint: string; 
    description: string; 
    children: React.ReactNode 
  }) => (
    <div className="mb-8 border-l-4 border-blue-500 pl-4">
      <div className="flex items-center gap-3 mb-2">
        <span className={`px-2 py-1 rounded text-xs font-bold ${
          method === 'GET' ? 'bg-green-100 text-green-800' :
          method === 'POST' ? 'bg-blue-100 text-blue-800' :
          'bg-purple-100 text-purple-800'
        }`}>
          {method}
        </span>
        <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">{endpoint}</code>
      </div>
      <p className="text-gray-600 mb-4">{description}</p>
      {children}
    </div>
  );

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">API Documentation</h1>
              <p className="text-gray-600">Complete guide to using the VerifyLens REST API</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition font-medium shadow-md flex items-center gap-2"
            >
              <span>←</span>
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">
          <div className="flex overflow-x-auto">
            {[
              { id: 'getting-started', label: 'Getting Started' },
              { id: 'authentication', label: 'Authentication' },
              { id: 'verify', label: 'Verify Endpoints' },
              { id: 'credits', label: 'Credits Endpoints' },
              { id: 'usage', label: 'Usage Endpoints' },
              { id: 'errors', label: 'Error Codes' },
              { id: 'rate-limits', label: 'Rate Limits' },
              { id: 'best-practices', label: 'Best Practices' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 font-medium transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-xl p-8">
          {activeTab === 'getting-started' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Getting Started</h2>
              
              <div className="prose max-w-none">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Overview</h3>
                <p className="text-gray-600 mb-4">
                  The VerifyLens API allows you to programmatically verify Roblox users, manage credits, and track usage statistics. 
                  All API requests are made over HTTPS and authenticated using API keys.
                </p>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Base URL</h3>
                <CodeBlock
                  id="base-url"
                  language="text"
                  code="https://www.verifylens.com/api/v1"
                />

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Quick Start</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 mb-6">
                  <li>Generate an API key from your <a href="/dashboard" className="text-blue-600 hover:underline">dashboard</a></li>
                  <li>Include the API key in the Authorization header of your requests</li>
                  <li>Make API calls to the endpoints documented below</li>
                  <li>Monitor your usage and credits in the dashboard</li>
                </ol>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Your First Request</h3>
                <p className="text-gray-600 mb-4">Here&apos;s a simple example to verify a Roblox username:</p>
                
                <CodeBlock
                  id="first-request-curl"
                  language="bash"
                  code={`curl -X POST https://www.verifylens.com/api/v1/verify \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"username": "Roblox"}'`}
                />
              </div>
            </div>
          )}

          {activeTab === 'authentication' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Authentication</h2>
              
              <div className="prose max-w-none">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">API Keys</h3>
                <p className="text-gray-600 mb-4">
                  All API requests must be authenticated using an API key. You can generate API keys from your dashboard. 
                  Each API key can have different scopes and rate limits.
                </p>

                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                  <p className="text-blue-800 font-medium">🔐 Security Best Practice</p>
                  <p className="text-blue-700 text-sm mt-1">
                    Never share your API keys or commit them to version control. Treat them like passwords.
                  </p>
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Using API Keys</h3>
                <p className="text-gray-600 mb-4">
                  Include your API key in the <code className="bg-gray-100 px-2 py-1 rounded">Authorization</code> header 
                  as a Bearer token:
                </p>

                <CodeBlock
                  id="auth-header"
                  language="text"
                  code="Authorization: Bearer vrl_live_1234567890abcdef"
                />

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">API Key Scopes</h3>
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Scope</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">verify:read</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Access to all verification endpoints</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">credits:read</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Check credit balance and history</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">credits:write</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Purchase credits via API</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">usage:read</td>
                        <td className="px-6 py-4 text-sm text-gray-600">View usage statistics and analytics</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'verify' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Verification Endpoints</h2>
              
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
                <p className="text-blue-800 font-medium">💳 Credit Deduction Policy</p>
                <p className="text-blue-700 text-sm mt-1">
                  Credits are deducted on every API call, even when results are served from cache. 
                  Each verification request costs 1 credit, regardless of whether the data is cached or freshly fetched.
                </p>
              </div>
              
              <EndpointSection
                method="POST"
                endpoint="/api/v1/verify"
                description="Verify a Roblox user by username"
              >
                <h4 className="font-semibold text-gray-800 mb-2">Request Body</h4>
                <CodeBlock
                  id="verify-request"
                  language="json"
                  code={`{
  "username": "Roblox"
}`}
                />

                <h4 className="font-semibold text-gray-800 mb-2 mt-4">Response</h4>
                <CodeBlock
                  id="verify-response"
                  language="json"
                  code={`{
  "success": true,
  "data": {
    "verified": true,
    "user": {
      "id": 1,
      "username": "Roblox",
      "displayName": "Roblox",
      "description": "...",
      "created": "2006-02-27T21:06:40.3Z",
      "isBanned": false,
      "hasVerifiedBadge": true
    },
    "creditsUsed": 1,
    "fromCache": false
  }
}`}
                />

                <h4 className="font-semibold text-gray-800 mb-2 mt-4">Code Examples</h4>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">JavaScript (Node.js)</p>
                    <CodeBlock
                      id="verify-js"
                      language="javascript"
                      code={`const response = await fetch('https://www.verifylens.com/api/v1/verify', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    username: 'Roblox'
  })
});

const data = await response.json();
console.log(data);`}
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Python</p>
                    <CodeBlock
                      id="verify-python"
                      language="python"
                      code={`import requests

response = requests.post(
    'https://www.verifylens.com/api/v1/verify',
    headers={
        'Authorization': 'Bearer YOUR_API_KEY',
        'Content-Type': 'application/json'
    },
    json={
        'username': 'Roblox'
    }
)

data = response.json()
print(data)`}
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">PHP</p>
                    <CodeBlock
                      id="verify-php"
                      language="php"
                      code={`<?php
$ch = curl_init('https://www.verifylens.com/api/v1/verify');

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer YOUR_API_KEY',
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode([
        'username' => 'Roblox'
    ])
]);

$response = curl_exec($ch);
$data = json_decode($response, true);
curl_close($ch);

print_r($data);
?>`}
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">cURL</p>
                    <CodeBlock
                      id="verify-curl"
                      language="bash"
                      code={`curl -X POST https://www.verifylens.com/api/v1/verify \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"username": "Roblox"}'`}
                    />
                  </div>
                </div>
              </EndpointSection>

              <EndpointSection
                method="POST"
                endpoint="/api/v1/verify/user-id"
                description="Verify a Roblox user by user ID"
              >
                <h4 className="font-semibold text-gray-800 mb-2">Request Body</h4>
                <CodeBlock
                  id="verify-id-request"
                  language="json"
                  code={`{
  "userId": 1
}`}
                />

                <h4 className="font-semibold text-gray-800 mb-2 mt-4">Response</h4>
                <CodeBlock
                  id="verify-id-response"
                  language="json"
                  code={`{
  "success": true,
  "data": {
    "verified": true,
    "user": {
      "id": 1,
      "username": "Roblox",
      "displayName": "Roblox",
      "description": "...",
      "created": "2006-02-27T21:06:40.3Z",
      "isBanned": false,
      "hasVerifiedBadge": true
    },
    "creditsUsed": 1,
    "fromCache": false
  }
}`}
                />
              </EndpointSection>

              <EndpointSection
                method="POST"
                endpoint="/api/v1/verify/batch"
                description="Verify multiple Roblox users at once (up to 100)"
              >
                <h4 className="font-semibold text-gray-800 mb-2">Request Body</h4>
                <CodeBlock
                  id="verify-batch-request"
                  language="json"
                  code={`{
  "usernames": ["Roblox", "builderman", "TestUser123"]
}`}
                />

                <h4 className="font-semibold text-gray-800 mb-2 mt-4">Response</h4>
                <CodeBlock
                  id="verify-batch-response"
                  language="json"
                  code={`{
  "success": true,
  "data": {
    "results": [
      {
        "username": "Roblox",
        "success": true,
        "verified": true,
        "user": { /* user data */ },
        "fromCache": false
      },
      {
        "username": "builderman",
        "success": true,
        "verified": true,
        "user": { /* user data */ },
        "fromCache": true
      },
      {
        "username": "TestUser123",
        "success": false,
        "error": "Invalid username"
      }
    ],
    "totalCreditsUsed": 3,
    "processed": 3
  }
}`}
                />
                
                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mt-4">
                  <p className="text-yellow-800 font-medium">⚠️ Important Note</p>
                  <p className="text-yellow-700 text-sm mt-1">
                    Credits are charged for each username in the batch, regardless of whether the result 
                    comes from cache or is a failed lookup. The <code className="bg-yellow-100 px-1 rounded">fromCache</code> field 
                    indicates whether the data was served from cache, but credits are still deducted.
                  </p>
                </div>
              </EndpointSection>
            </div>
          )}

          {activeTab === 'credits' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Credits Endpoints</h2>
              
              <EndpointSection
                method="GET"
                endpoint="/api/v1/credits/balance"
                description="Get current credit balance and usage statistics"
              >
                <h4 className="font-semibold text-gray-800 mb-2">Response</h4>
                <CodeBlock
                  id="balance-response"
                  language="json"
                  code={`{
  "success": true,
  "data": {
    "balance": 1000,
    "totalPurchased": 5000,
    "totalUsed": 4000,
    "transactions": [
      {
        "id": 123,
        "type": "PURCHASE",
        "amount": 1000,
        "balance_after": 1000,
        "description": "Credit package purchase",
        "created_at": "2025-11-12T10:00:00Z"
      }
    ]
  }
}`}
                />

                <h4 className="font-semibold text-gray-800 mb-2 mt-4">Code Examples</h4>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">JavaScript</p>
                    <CodeBlock
                      id="balance-js"
                      language="javascript"
                      code={`const response = await fetch('https://www.verifylens.com/api/v1/credits/balance', {
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY'
  }
});

const data = await response.json();
console.log(\`Current balance: \${data.data.balance} credits\`);`}
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Python</p>
                    <CodeBlock
                      id="balance-python"
                      language="python"
                      code={`import requests

response = requests.get(
    'https://www.verifylens.com/api/v1/credits/balance',
    headers={'Authorization': 'Bearer YOUR_API_KEY'}
)

data = response.json()
print(f"Current balance: {data['data']['balance']} credits")`}
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">PHP</p>
                    <CodeBlock
                      id="balance-php"
                      language="php"
                      code={`<?php
$ch = curl_init('https://www.verifylens.com/api/v1/credits/balance');

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer YOUR_API_KEY'
    ]
]);

$response = curl_exec($ch);
$data = json_decode($response, true);
curl_close($ch);

echo "Current balance: " . $data['data']['balance'] . " credits";
?>`}
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">cURL</p>
                    <CodeBlock
                      id="balance-curl"
                      language="bash"
                      code={`curl -X GET https://www.verifylens.com/api/v1/credits/balance \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
                    />
                  </div>
                </div>
              </EndpointSection>
            </div>
          )}

          {activeTab === 'usage' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Usage Endpoints</h2>
              
              <EndpointSection
                method="GET"
                endpoint="/api/v1/usage"
                description="Get detailed usage statistics and analytics"
              >
                <h4 className="font-semibold text-gray-800 mb-2">Query Parameters</h4>
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Parameter</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">startDate</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">string</td>
                        <td className="px-6 py-4 text-sm">Start date (ISO format)</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">endDate</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">string</td>
                        <td className="px-6 py-4 text-sm">End date (ISO format)</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">endpoint</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">string</td>
                        <td className="px-6 py-4 text-sm">Filter by specific endpoint</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h4 className="font-semibold text-gray-800 mb-2">Response</h4>
                <CodeBlock
                  id="usage-response"
                  language="json"
                  code={`{
  "success": true,
  "data": {
    "totalRequests": 1500,
    "successfulRequests": 1450,
    "failedRequests": 50,
    "averageResponseTime": 245,
    "requestsByEndpoint": {
      "/api/v1/verify": 1200,
      "/api/v1/verify/batch": 200,
      "/api/v1/credits/balance": 100
    },
    "requestsByDate": [
      {
        "date": "2025-11-01",
        "count": 150
      },
      {
        "date": "2025-11-02",
        "count": 200
      }
    ]
  }
}`}
                />

                <h4 className="font-semibold text-gray-800 mb-2 mt-4">Code Examples</h4>
                
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">JavaScript</p>
                    <CodeBlock
                      id="usage-js"
                      language="javascript"
                      code={`const startDate = '2025-11-01';
const endDate = '2025-11-12';

const response = await fetch(
  \`https://www.verifylens.com/api/v1/usage?startDate=\${startDate}&endDate=\${endDate}\`,
  {
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY'
    }
  }
);

const data = await response.json();
console.log(\`Total requests: \${data.data.totalRequests}\`);`}
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">Python</p>
                    <CodeBlock
                      id="usage-python"
                      language="python"
                      code={`import requests

params = {
    'startDate': '2025-11-01',
    'endDate': '2025-11-12'
}

response = requests.get(
    'https://www.verifylens.com/api/v1/usage',
    headers={'Authorization': 'Bearer YOUR_API_KEY'},
    params=params
)

data = response.json()
print(f"Total requests: {data['data']['totalRequests']}")`}
                    />
                  </div>

                  <div>
                    <p className="text-sm text-gray-600 mb-2">cURL</p>
                    <CodeBlock
                      id="usage-curl"
                      language="bash"
                      code={`curl -X GET "https://www.verifylens.com/api/v1/usage?startDate=2025-11-01&endDate=2025-11-12" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
                    />
                  </div>
                </div>
              </EndpointSection>
            </div>
          )}

          {activeTab === 'errors' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Error Codes & Troubleshooting</h2>
              
              <div className="prose max-w-none">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Error Response Format</h3>
                <p className="text-gray-600 mb-4">
                  All errors follow a consistent format:
                </p>
                
                <CodeBlock
                  id="error-format"
                  language="json"
                  code={`{
  "error": "Error message describing what went wrong",
  "statusCode": 400,
  "details": {
    // Additional error details (optional)
  }
}`}
                />

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">HTTP Status Codes</h3>
                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Meaning</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Common Causes</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-green-600">200</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">OK</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Request succeeded</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-yellow-600">400</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">Bad Request</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Invalid request parameters or missing required fields</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-red-600">401</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">Unauthorized</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Missing or invalid API key</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-red-600">403</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">Forbidden</td>
                        <td className="px-6 py-4 text-sm text-gray-600">API key lacks required scope or insufficient credits</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-yellow-600">404</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">Not Found</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Endpoint doesn&apos;t exist or resource not found</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-yellow-600">429</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">Too Many Requests</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Rate limit exceeded</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-red-600">500</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">Internal Server Error</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Server error - contact support if persistent</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-red-600">503</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">Service Unavailable</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Service is temporarily down - retry later</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Common Error Messages</h3>
                
                <div className="space-y-4">
                  <div className="border-l-4 border-red-500 pl-4 py-2">
                    <p className="font-mono text-sm text-red-600">Invalid or missing API key</p>
                    <p className="text-gray-600 text-sm mt-1">
                      <strong>Solution:</strong> Ensure you&apos;ve included the Authorization header with your API key. 
                      Format: <code className="bg-gray-100 px-2 py-1 rounded">Authorization: Bearer YOUR_API_KEY</code>
                    </p>
                  </div>

                  <div className="border-l-4 border-red-500 pl-4 py-2">
                    <p className="font-mono text-sm text-red-600">Insufficient credits</p>
                    <p className="text-gray-600 text-sm mt-1">
                      <strong>Solution:</strong> Purchase more credits from your <a href="/dashboard" className="text-blue-600 hover:underline">dashboard</a>. 
                      Each verification request costs 1 credit.
                    </p>
                  </div>

                  <div className="border-l-4 border-yellow-500 pl-4 py-2">
                    <p className="font-mono text-sm text-yellow-600">Rate limit exceeded</p>
                    <p className="text-gray-600 text-sm mt-1">
                      <strong>Solution:</strong> Wait before making more requests. Check the <code className="bg-gray-100 px-2 py-1 rounded">X-RateLimit-Reset</code> header 
                      for when your rate limit resets. Consider upgrading your API key rate limit if needed.
                    </p>
                  </div>

                  <div className="border-l-4 border-yellow-500 pl-4 py-2">
                    <p className="font-mono text-sm text-yellow-600">Username not found</p>
                    <p className="text-gray-600 text-sm mt-1">
                      <strong>Solution:</strong> The username doesn&apos;t exist on Roblox. Verify the spelling and try again. 
                      This still consumes 1 credit.
                    </p>
                  </div>

                  <div className="border-l-4 border-red-500 pl-4 py-2">
                    <p className="font-mono text-sm text-red-600">Missing required scope</p>
                    <p className="text-gray-600 text-sm mt-1">
                      <strong>Solution:</strong> Your API key doesn&apos;t have the required scope for this endpoint. 
                      Generate a new API key with the necessary scopes from your dashboard.
                    </p>
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Debugging Tips</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li>Check response headers for rate limit information (<code className="bg-gray-100 px-2 py-1 rounded">X-RateLimit-*</code>)</li>
                  <li>Verify your API key is active in the dashboard</li>
                  <li>Ensure you&apos;re using the correct HTTP method (GET vs POST)</li>
                  <li>Validate your JSON request body format</li>
                  <li>Check your credit balance before making requests</li>
                  <li>Monitor usage statistics to identify patterns in errors</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'rate-limits' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Rate Limiting</h2>
              
              <div className="prose max-w-none">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Overview</h3>
                <p className="text-gray-600 mb-4">
                  Rate limits prevent abuse and ensure fair usage of the API. Each API key has configurable rate limits 
                  that you can set when creating the key.
                </p>

                <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
                  <p className="text-yellow-800 font-medium">⚡ Default Rate Limit</p>
                  <p className="text-yellow-700 text-sm mt-1">
                    By default, API keys are limited to 1000 requests per hour. You can adjust this when creating the key.
                  </p>
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Rate Limit Headers</h3>
                <p className="text-gray-600 mb-4">
                  Every API response includes rate limit information in the headers:
                </p>

                <div className="overflow-x-auto mb-6">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Header</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">X-RateLimit-Limit</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Maximum requests allowed per hour</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">X-RateLimit-Remaining</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Remaining requests in current window</td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">X-RateLimit-Reset</td>
                        <td className="px-6 py-4 text-sm text-gray-600">Unix timestamp when the rate limit resets</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Handling Rate Limits</h3>
                <p className="text-gray-600 mb-4">
                  When you exceed your rate limit, you&apos;ll receive a 429 Too Many Requests response:
                </p>

                <CodeBlock
                  id="rate-limit-error"
                  language="json"
                  code={`{
  "error": "Rate limit exceeded",
  "statusCode": 429,
  "retryAfter": 3600
}`}
                />

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Best Practices</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-600 mb-6">
                  <li>Monitor the <code className="bg-gray-100 px-2 py-1 rounded">X-RateLimit-Remaining</code> header</li>
                  <li>Implement exponential backoff when hitting rate limits</li>
                  <li>Cache verification results when possible to reduce API calls</li>
                  <li>Use batch endpoints to verify multiple users with fewer requests</li>
                  <li>Distribute requests evenly over time rather than bursting</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Example: Rate Limit Handling</h3>
                <CodeBlock
                  id="rate-limit-handling"
                  language="javascript"
                  code={`async function makeApiRequest(url, options) {
  const response = await fetch(url, options);
  
  // Check rate limit headers
  const remaining = parseInt(response.headers.get('X-RateLimit-Remaining'));
  const reset = parseInt(response.headers.get('X-RateLimit-Reset'));
  
  if (response.status === 429) {
    // Wait until rate limit resets
    const waitTime = (reset * 1000) - Date.now();
    console.log(\`Rate limit exceeded. Waiting \${waitTime / 1000}s\`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
    
    // Retry the request
    return makeApiRequest(url, options);
  }
  
  // Warn when approaching rate limit
  if (remaining < 10) {
    console.warn(\`Warning: Only \${remaining} requests remaining\`);
  }
  
  return response;
}`}
                />
              </div>
            </div>
          )}

          {activeTab === 'best-practices' && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">Best Practices & Security</h2>
              
              <div className="prose max-w-none">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Security Best Practices</h3>
                
                <div className="space-y-4 mb-6">
                  <div className="bg-red-50 border-l-4 border-red-500 p-4">
                    <p className="text-red-800 font-medium">🔒 Never Expose API Keys</p>
                    <ul className="text-red-700 text-sm mt-2 space-y-1 list-disc list-inside">
                      <li>Don&apos;t commit API keys to version control (Git, SVN, etc.)</li>
                      <li>Don&apos;t include API keys in client-side code (JavaScript, mobile apps)</li>
                      <li>Don&apos;t share API keys in public forums or support tickets</li>
                      <li>Use environment variables to store API keys</li>
                    </ul>
                  </div>

                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                    <p className="text-blue-800 font-medium">🔑 API Key Management</p>
                    <ul className="text-blue-700 text-sm mt-2 space-y-1 list-disc list-inside">
                      <li>Create separate API keys for different applications</li>
                      <li>Use descriptive names to identify where each key is used</li>
                      <li>Rotate API keys regularly (every 90 days recommended)</li>
                      <li>Revoke unused or compromised API keys immediately</li>
                      <li>Use minimum required scopes for each API key</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 border-l-4 border-green-500 p-4">
                    <p className="text-green-800 font-medium">✅ Request Best Practices</p>
                    <ul className="text-green-700 text-sm mt-2 space-y-1 list-disc list-inside">
                      <li>Always use HTTPS (never HTTP) for API requests</li>
                      <li>Implement proper error handling for all API calls</li>
                      <li>Set reasonable timeouts for API requests (30s recommended)</li>
                      <li>Validate user input before sending to API</li>
                      <li>Log API errors for debugging but don&apos;t log sensitive data</li>
                    </ul>
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Performance Optimization</h3>
                
                <div className="space-y-4 mb-6">
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">1. Use Client-Side Caching</h4>
                    <p className="text-gray-600 mb-2">
                      While the API automatically caches verification results on the server for 5 minutes, 
                      <strong> credits are still deducted on every API call</strong>, even when results are served from cache. 
                      To avoid unnecessary credit usage, implement your own client-side caching layer:
                    </p>
                    
                    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4">
                      <p className="text-amber-800 font-medium">💡 Important: Credit Deduction</p>
                      <p className="text-amber-700 text-sm mt-1">
                        Server-side caching improves response times but does NOT save credits. Each API request 
                        costs 1 credit regardless of cache status. Implement client-side caching to reduce credit consumption.
                      </p>
                    </div>
                    
                    <CodeBlock
                      id="caching-example"
                      language="javascript"
                      code={`const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function verifyUser(username) {
  const cacheKey = \`verify:\${username}\`;
  const cached = cache.get(cacheKey);
  
  // Return cached data WITHOUT making an API call
  // This saves credits!
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Using client cache - no API call, no credits used');
    return cached.data;
  }
  
  // Make API call - this will cost 1 credit
  console.log('Making API call - 1 credit will be deducted');
  const response = await fetch('https://www.verifylens.com/api/v1/verify', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_API_KEY',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username })
  });
  
  const data = await response.json();
  
  // Store in client cache for future requests
  cache.set(cacheKey, { data, timestamp: Date.now() });
  
  return data;
}`}
                    />
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">2. Batch Requests</h4>
                    <p className="text-gray-600 mb-2">
                      When verifying multiple users, use the batch endpoint instead of individual requests:
                    </p>
                    <CodeBlock
                      id="batch-example"
                      language="javascript"
                      code={`// ❌ Inefficient: Multiple individual requests
for (const username of usernames) {
  await verifyUser(username);
}

// ✅ Efficient: Single batch request
const response = await fetch('https://www.verifylens.com/api/v1/verify/batch', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ usernames })
});`}
                    />
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">3. Connection Pooling</h4>
                    <p className="text-gray-600 mb-2">
                      Reuse HTTP connections to reduce overhead:
                    </p>
                    <CodeBlock
                      id="pooling-example"
                      language="javascript"
                      code={`// Node.js example with connection pooling
const https = require('https');

const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 10
});

const response = await fetch('https://www.verifylens.com/api/v1/verify', {
  method: 'POST',
  agent: agent,
  headers: { /* ... */ },
  body: JSON.stringify({ /* ... */ })
});`}
                    />
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Error Handling</h3>
                <p className="text-gray-600 mb-4">
                  Implement comprehensive error handling for production applications:
                </p>
                <CodeBlock
                  id="error-handling-example"
                  language="javascript"
                  code={`async function safeVerifyUser(username) {
  try {
    const response = await fetch('https://www.verifylens.com/api/v1/verify', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${process.env.VERIFYLENS_API_KEY}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username }),
      signal: AbortSignal.timeout(30000) // 30 second timeout
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Invalid API key');
      } else if (response.status === 403) {
        throw new Error('Insufficient credits or permissions');
      } else if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 60;
        throw new Error(\`Rate limit exceeded. Retry after \${retryAfter}s\`);
      } else if (response.status >= 500) {
        throw new Error('API server error. Please try again later.');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Unknown error');
      }
    }
    
    return await response.json();
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timeout');
    }
    console.error('Verification error:', error);
    throw error;
  }
}`}
                />

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Monitoring & Debugging</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-600 mb-6">
                  <li>Monitor your credit balance regularly to avoid service interruption</li>
                  <li>Track usage statistics to identify unusual patterns or spikes</li>
                  <li>Set up alerts for low credit balance or high error rates</li>
                  <li>Review API key last used timestamps to identify unused keys</li>
                  <li>Keep logs of API responses for troubleshooting</li>
                  <li>Use the usage endpoint to analyze API performance</li>
                </ul>

                <h3 className="text-xl font-semibold text-gray-800 mb-4 mt-6">Production Checklist</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-gray-700">API keys stored in environment variables</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-gray-700">Error handling implemented for all API calls</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-gray-700">Request timeouts configured</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-gray-700">Rate limit handling in place</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-gray-700">Caching strategy implemented</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-gray-700">Monitoring and alerting set up</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-gray-700">Minimum required scopes used</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span className="text-gray-700">SSL/TLS certificate validation enabled</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <div className="text-center text-gray-600">
            <p className="mb-2">Need help? Have questions?</p>
            <p className="text-sm">
              Visit your <a href="/dashboard" className="text-blue-600 hover:underline">dashboard</a> to manage your API keys and monitor usage.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
