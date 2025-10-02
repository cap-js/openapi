const fs = require('fs');

const LCOV_FILE = 'lcov.info';
const LINE_THRESHOLD = parseFloat(process.env.COVERAGE_THRESHOLD_LINE ?? '90.0');
const BRANCH_THRESHOLD = parseFloat(process.env.COVERAGE_THRESHOLD_BRANCH ?? '90.0');


let totalLinesFound = 0;
let totalLinesHit = 0;
let totalBranchesFound = 0;
let totalBranchesHit = 0;

try {
  const lcov = fs.readFileSync(LCOV_FILE, 'utf-8');
  const lines = lcov.split('\n');

  for (const line of lines) {
    if (line.startsWith('LF:')) {
      totalLinesFound += parseInt(line.slice(3), 10);
    } else if (line.startsWith('LH:')) {
      totalLinesHit += parseInt(line.slice(3), 10);
    } else if (line.startsWith('BRF:')) {
      totalBranchesFound += parseInt(line.slice(4), 10);
    } else if (line.startsWith('BRH:')) {
      totalBranchesHit += parseInt(line.slice(4), 10);
    }
  }

  const lineCoverage = totalLinesFound > 0
    ? (totalLinesHit / totalLinesFound) * 100
    : 100;

  const branchCoverage = totalBranchesFound > 0
    ? (totalBranchesHit / totalBranchesFound) * 100
    : 100;

  console.log(`Line Coverage:   ${lineCoverage.toFixed(2)}%`);
  console.log(`Branch Coverage: ${branchCoverage.toFixed(2)}%`);

  let failed = false;

  if (lineCoverage < LINE_THRESHOLD) {
    console.error(`❌ Line coverage below threshold (${lineCoverage.toFixed(2)}% < ${LINE_THRESHOLD}%)`);
    failed = true;
  }

  if (branchCoverage < BRANCH_THRESHOLD) {
    console.error(`❌ Branch coverage below threshold (${branchCoverage.toFixed(2)}% < ${BRANCH_THRESHOLD}%)`);
    failed = true;
  }

  process.exit(failed ? 1 : 0);

} catch (err) {
  console.error(`❌ Error reading or parsing ${LCOV_FILE}:`, err.message);
  process.exit(2);
}
