#!/usr/bin/env node
/**
 * test-n8n-workflows.mjs
 * Comprehensive validation test suite for EduLedger n8n parent communication workflows.
 * Validates structural integrity, connections, parameters, retry options, and credentials.
 */
import fs from "node:fs";
import path from "node:path";

const WORKFLOWS_DIR = path.join(process.cwd(), "n8n", "workflows");

const EXPECTED_WORKFLOWS = [
  { file: "workflow-a-attendance.json", name: "Attendance", minNodes: 4 },
  { file: "workflow-b-fee-reminder.json", name: "Fee Reminder", minNodes: 4 },
  { file: "workflow-c-payment-confirmation.json", name: "Payment Confirmation", minNodes: 4 },
  { file: "workflow-d-examination-results.json", name: "Examination Results", minNodes: 4 },
  { file: "workflow-e-homework-notification.json", name: "Homework", minNodes: 4 },
  { file: "workflow-f-school-announcements.json", name: "School Announcements", minNodes: 4 },
  { file: "workflow-g-leave-notification.json", name: "Leave Notification", minNodes: 4 },
  { file: "workflow-h-timetable-notification.json", name: "Timetable Notification", minNodes: 4 },
  { file: "workflow-status-tracking.json", name: "Status Tracking", minNodes: 3 },
];

console.log("==================================================================");
console.log("   EDULEDGER n8n WORKFLOW INTEGRATION & SCHEMA VALIDATION SUITE   ");
console.log("==================================================================\n");

if (!fs.existsSync(WORKFLOWS_DIR)) {
  console.error(`[FATAL] Workflows directory not found: ${WORKFLOWS_DIR}`);
  process.exit(1);
}

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const errors = [];

for (const item of EXPECTED_WORKFLOWS) {
  totalTests++;
  const filePath = path.join(WORKFLOWS_DIR, item.file);

  console.log(`Testing Workflow [${item.file}] (${item.name})...`);

  if (!fs.existsSync(filePath)) {
    errors.push(`File missing: ${item.file}`);
    failedTests++;
    console.log(`  ❌ FAIL: File does not exist: ${filePath}\n`);
    continue;
  }

  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    errors.push(`Read error in ${item.file}: ${err.message}`);
    failedTests++;
    console.log(`  ❌ FAIL: Read error: ${err.message}\n`);
    continue;
  }

  let workflow;
  try {
    workflow = JSON.parse(content);
  } catch (err) {
    errors.push(`JSON Syntax error in ${item.file}: ${err.message}`);
    failedTests++;
    console.log(`  ❌ FAIL: JSON Syntax Error: ${err.message}\n`);
    continue;
  }

  const issues = [];

  // 1. Top level attributes
  if (!workflow.name || typeof workflow.name !== "string") {
    issues.push("Missing or invalid 'name' field");
  }

  if (workflow.active !== false) {
    issues.push("Workflow 'active' flag must be false for safe production import");
  }

  if (!Array.isArray(workflow.nodes) || workflow.nodes.length < item.minNodes) {
    issues.push(`Expected at least ${item.minNodes} nodes, found ${workflow.nodes?.length ?? 0}`);
  }

  if (!workflow.connections || typeof workflow.connections !== "object") {
    issues.push("Missing or invalid 'connections' object");
  }

  // 2. Validate node definitions
  const nodeNames = new Set();
  const nodeIds = new Set();

  if (Array.isArray(workflow.nodes)) {
    for (const node of workflow.nodes) {
      if (!node.name) issues.push(`Node without name found: ${JSON.stringify(node)}`);
      if (nodeNames.has(node.name)) issues.push(`Duplicate node name: ${node.name}`);
      nodeNames.add(node.name);

      if (node.id) {
        if (nodeIds.has(node.id)) issues.push(`Duplicate node id: ${node.id}`);
        nodeIds.add(node.id);
      }

      if (!node.type || typeof node.type !== "string") {
        issues.push(`Node '${node.name}' has invalid or missing 'type'`);
      }

      if (!Array.isArray(node.position) || node.position.length !== 2) {
        issues.push(`Node '${node.name}' missing visual coordinates [x, y]`);
      }

      // Check HTTP Request nodes for Meta Cloud API v21.0 and retries
      if (node.type === "n8n-nodes-base.httpRequest") {
        const url = node.parameters?.url || "";
        if (typeof url === "string" && url.includes("graph.facebook.com")) {
          if (!url.includes("v21.0")) {
            issues.push(`Node '${node.name}' does not use Meta Graph API v21.0 (found: ${url})`);
          }
          // Check for hardcoded secrets
          if (/EAA[a-zA-Z0-9]{50,}/.test(url) || /EAA[a-zA-Z0-9]{50,}/.test(JSON.stringify(node.parameters))) {
            issues.push(`Node '${node.name}' contains what appears to be a hardcoded Meta access token`);
          }
        }

        const options = node.parameters?.options || {};
        if (options.retryOnFail !== true) {
          issues.push(`Node '${node.name}' missing retryOnFail: true`);
        }
        if (options.maxTries < 2) {
          issues.push(`Node '${node.name}' maxTries must be >= 2 (found: ${options.maxTries})`);
        }
      }

      // Check Webhook nodes
      if (node.type === "n8n-nodes-base.webhook") {
        if (node.parameters?.httpMethod !== "POST") {
          issues.push(`Node '${node.name}' webhook httpMethod must be POST (found: ${node.parameters?.httpMethod})`);
        }
      }
    }
  }

  // 3. Validate connection wiring
  if (workflow.connections && typeof workflow.connections === "object") {
    for (const [sourceNode, branchGroup] of Object.entries(workflow.connections)) {
      if (!nodeNames.has(sourceNode)) {
        issues.push(`Connection source '${sourceNode}' does not exist in nodes`);
      }
      if (branchGroup.main && Array.isArray(branchGroup.main)) {
        for (const branch of branchGroup.main) {
          if (Array.isArray(branch)) {
            for (const target of branch) {
              if (!target.node || !nodeNames.has(target.node)) {
                issues.push(`Connection target '${target?.node}' from '${sourceNode}' does not exist in nodes`);
              }
            }
          }
        }
      }
    }
  }

  if (issues.length > 0) {
    failedTests++;
    errors.push(`Defects in ${item.file}:\n    - ${issues.join("\n    - ")}`);
    console.log(`  ❌ FAIL (${issues.length} issues):`);
    for (const issue of issues) {
      console.log(`     - ${issue}`);
    }
    console.log("");
  } else {
    passedTests++;
    console.log(`  ✓ PASS: All ${workflow.nodes.length} nodes, wiring, retry policies, and API v21.0 verified.\n`);
  }
}

console.log("==================================================================");
console.log(`TEST SUMMARY: Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
console.log("==================================================================");

if (failedTests > 0) {
  console.error(`\nFAILED WORKFLOWS (${failedTests}):`);
  for (const err of errors) {
    console.error(`\n${err}`);
  }
  process.exit(1);
} else {
  console.log("\nALL 9 n8n WORKFLOWS ARE PRODUCTION-VALIDATED AND READY FOR IMPORT.\n");
  process.exit(0);
}

