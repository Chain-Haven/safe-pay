// GitHub Automation for Provider Integration
// 
// Creates Pull Requests for AI-generated provider code.
// NEVER auto-merges - always requires human review.

import type { GeneratedProvider } from './provider-code-generator';
import type { TestSuiteResult } from './provider-testing';

/**
 * GitHub configuration
 */
interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  baseBranch: string;
}

/**
 * PR creation result
 */
export interface PRCreationResult {
  success: boolean;
  prNumber?: number;
  prUrl?: string;
  branchName?: string;
  error?: string;
}

/**
 * Get GitHub configuration from environment
 */
function getGitHubConfig(): GitHubConfig | null {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    console.log('[GitHub] No GITHUB_TOKEN configured');
    return null;
  }
  
  return {
    owner: process.env.GITHUB_OWNER || 'Chain-Haven',
    repo: process.env.GITHUB_REPO || 'safe-pay',
    token,
    baseBranch: process.env.GITHUB_BASE_BRANCH || 'main',
  };
}

/**
 * Make GitHub API request
 */
async function githubRequest<T>(
  config: GitHubConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }
  
  return response.json();
}

/**
 * Get the SHA of the base branch
 */
async function getBaseBranchSha(config: GitHubConfig): Promise<string> {
  const ref = await githubRequest<{ object: { sha: string } }>(
    config,
    `/repos/${config.owner}/${config.repo}/git/ref/heads/${config.baseBranch}`
  );
  return ref.object.sha;
}

/**
 * Create a new branch
 */
async function createBranch(
  config: GitHubConfig,
  branchName: string,
  baseSha: string
): Promise<void> {
  await githubRequest(
    config,
    `/repos/${config.owner}/${config.repo}/git/refs`,
    {
      method: 'POST',
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    }
  );
}

/**
 * Create or update a file in the repository
 */
async function createFile(
  config: GitHubConfig,
  branchName: string,
  path: string,
  content: string,
  message: string
): Promise<void> {
  // Check if file exists
  let existingSha: string | undefined;
  try {
    const existing = await githubRequest<{ sha: string }>(
      config,
      `/repos/${config.owner}/${config.repo}/contents/${path}?ref=${branchName}`
    );
    existingSha = existing.sha;
  } catch {
    // File doesn't exist, which is fine
  }
  
  await githubRequest(
    config,
    `/repos/${config.owner}/${config.repo}/contents/${path}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: Buffer.from(content).toString('base64'),
        branch: branchName,
        sha: existingSha,
      }),
    }
  );
}

/**
 * Create a Pull Request
 */
async function createPullRequest(
  config: GitHubConfig,
  branchName: string,
  title: string,
  body: string
): Promise<{ number: number; html_url: string }> {
  return githubRequest(
    config,
    `/repos/${config.owner}/${config.repo}/pulls`,
    {
      method: 'POST',
      body: JSON.stringify({
        title,
        body,
        head: branchName,
        base: config.baseBranch,
        draft: true,  // Always create as draft for safety
      }),
    }
  );
}

/**
 * Add labels to a PR
 */
async function addLabels(
  config: GitHubConfig,
  prNumber: number,
  labels: string[]
): Promise<void> {
  try {
    await githubRequest(
      config,
      `/repos/${config.owner}/${config.repo}/issues/${prNumber}/labels`,
      {
        method: 'POST',
        body: JSON.stringify({ labels }),
      }
    );
  } catch (error) {
    // Labels might not exist, that's okay
    console.log('[GitHub] Could not add labels (they may not exist)');
  }
}

/**
 * Generate PR body with test results and review checklist
 */
function generatePRBody(
  provider: GeneratedProvider,
  testResults: TestSuiteResult | null,
  analysisNotes: string
): string {
  const testSection = testResults ? `
## Test Results

| Metric | Value |
|--------|-------|
| Total Tests | ${testResults.totalTests} |
| Passed | ${testResults.passed} |
| Failed | ${testResults.failed} |
| Duration | ${testResults.duration}ms |
| Safe to Integrate | ${testResults.safeToIntegrate ? '✅ Yes' : '❌ No'} |

### Individual Tests
${testResults.tests.map(t => `- ${t.passed ? '✅' : '❌'} ${t.name}${t.error ? ` (${t.error})` : ''}`).join('\n')}

${testResults.warnings.length > 0 ? `### Warnings\n${testResults.warnings.map(w => `- ⚠️ ${w}`).join('\n')}` : ''}
` : `
## Test Results
⚠️ Runtime tests pending - will run in CI pipeline.
`;

  const validationSection = provider.validated ? `
## Code Validation
✅ Static code analysis passed
` : `
## Code Validation
❌ Validation errors:
${provider.validationErrors.map(e => `- ${e}`).join('\n')}
`;

  return `## 🤖 Auto-Generated Provider: ${provider.name}

This PR was automatically generated by the SafePay AI Provider Discovery System.

**⚠️ REQUIRES HUMAN REVIEW - DO NOT AUTO-MERGE**

### Provider Information
- **Name:** ${provider.name}
- **Class:** ${provider.className}
- **File:** ${provider.filename}

${validationSection}

${testSection}

## Integration Notes
${provider.integrationNotes || 'No additional notes.'}

${analysisNotes ? `## Analysis Notes\n${analysisNotes}` : ''}

## Review Checklist

Before merging, please verify:

- [ ] API endpoints are correct and functional
- [ ] Error handling is appropriate
- [ ] Rate limiting is respected
- [ ] No sensitive data exposure
- [ ] Response mapping is accurate
- [ ] Provider is operational (check their website)
- [ ] Test the provider manually with a small swap
- [ ] Code follows project conventions
- [ ] No security vulnerabilities

## How to Test Locally

\`\`\`bash
# 1. Checkout this branch
git checkout ${provider.className.toLowerCase()}-integration

# 2. Install dependencies
pnpm install

# 3. Run provider tests
pnpm test -- --grep "${provider.className}"

# 4. Start dev server and test manually
pnpm dev
\`\`\`

---
*This PR was auto-generated on ${new Date().toISOString()}*
*Do not merge without thorough human review*
`;
}

/**
 * Create a PR for a new provider integration
 */
export async function createProviderPR(
  provider: GeneratedProvider,
  testResults: TestSuiteResult | null = null,
  analysisNotes: string = ''
): Promise<PRCreationResult> {
  const config = getGitHubConfig();
  
  if (!config) {
    return {
      success: false,
      error: 'GitHub token not configured. Set GITHUB_TOKEN environment variable.',
    };
  }
  
  // Safety check - don't create PR if validation failed
  if (!provider.validated && provider.validationErrors.length > 0) {
    console.log('[GitHub] Provider code validation failed, not creating PR');
    return {
      success: false,
      error: `Validation failed: ${provider.validationErrors.join(', ')}`,
    };
  }
  
  const branchName = `auto/provider-${provider.className.toLowerCase()}-${Date.now()}`;
  const timestamp = new Date().toISOString().split('T')[0];
  
  console.log(`[GitHub] Creating PR for ${provider.name} on branch ${branchName}`);
  
  try {
    // Step 1: Get base branch SHA
    const baseSha = await getBaseBranchSha(config);
    console.log(`[GitHub] Base branch SHA: ${baseSha.substring(0, 7)}`);
    
    // Step 2: Create new branch
    await createBranch(config, branchName, baseSha);
    console.log(`[GitHub] Created branch: ${branchName}`);
    
    // Step 3: Add provider implementation file
    const providerPath = `apps/api/src/packages/providers/providers/${provider.filename}`;
    await createFile(
      config,
      branchName,
      providerPath,
      provider.code,
      `feat: Add ${provider.name} provider implementation`
    );
    console.log(`[GitHub] Created file: ${providerPath}`);
    
    // Step 4: Add test file
    const testPath = `apps/api/src/packages/providers/providers/__tests__/${provider.filename.replace('.ts', '.test.ts')}`;
    await createFile(
      config,
      branchName,
      testPath,
      provider.testCode,
      `test: Add tests for ${provider.name} provider`
    );
    console.log(`[GitHub] Created file: ${testPath}`);
    
    // Step 5: Create PR (as draft)
    const prBody = generatePRBody(provider, testResults, analysisNotes);
    const pr = await createPullRequest(
      config,
      branchName,
      `🤖 [Auto] Add ${provider.name} swap provider`,
      prBody
    );
    console.log(`[GitHub] Created PR #${pr.number}: ${pr.html_url}`);
    
    // Step 6: Add labels
    await addLabels(config, pr.number, [
      'auto-generated',
      'needs-review',
      'provider-integration',
    ]);
    
    return {
      success: true,
      prNumber: pr.number,
      prUrl: pr.html_url,
      branchName,
    };
  } catch (error: any) {
    console.error('[GitHub] Failed to create PR:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Check if GitHub automation is enabled
 */
export function isGitHubAutomationEnabled(): boolean {
  return !!process.env.GITHUB_TOKEN;
}

/**
 * Rate limiting - max PRs per day
 */
const MAX_PRS_PER_DAY = 3;
let prCountToday = 0;
let lastPRDate = '';

/**
 * Check if we can create another PR (rate limiting)
 */
export function canCreatePR(): boolean {
  const today = new Date().toISOString().split('T')[0];
  
  if (today !== lastPRDate) {
    prCountToday = 0;
    lastPRDate = today;
  }
  
  return prCountToday < MAX_PRS_PER_DAY;
}

/**
 * Increment PR count (call after successful PR creation)
 */
export function incrementPRCount(): void {
  prCountToday++;
}

/**
 * Get remaining PR quota for today
 */
export function getRemainingPRQuota(): number {
  const today = new Date().toISOString().split('T')[0];
  
  if (today !== lastPRDate) {
    return MAX_PRS_PER_DAY;
  }
  
  return Math.max(0, MAX_PRS_PER_DAY - prCountToday);
}
