interface Score {
  numerator: number;
  denominator: number;
}

interface CourseStats {
  totalNumerator: number;
  totalDenominator: number;
  scores: Score[];
}

function init() {
  checkAndInject();

  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      checkAndInject();
    }
  });

  if (document.body) {
    urlObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    setTimeout(() => {
      if (document.body) {
        urlObserver.observe(document.body, { childList: true, subtree: true });
      }
    }, 100);
  }
}

function checkAndInject() {
  if (!window.location.href.includes("/results/main/table")) {
    return;
  }

  console.log("Puntenlijst pagina gedetecteerd!");

  setupTableObserver();
}

function setupTableObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        const evaluations = document.querySelectorAll(".cell--evaluation");
        if (evaluations.length > 0) {
          console.log(`Tabel geladen - ${evaluations.length} evaluaties gevonden`);
          injectCoursePercentages();
          break;
        }
      }
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    setTimeout(() => setupTableObserver(), 100);
  }
}

/**
 * Haal score uit title attribuut (bijv. "8,5/20" -> {numerator: 8.5, denominator: 20})
 */
function parseScore(titleText: string): Score | null {
  if (!titleText) return null;

  const match = titleText.match(/([\d,\.]+)\/([\d,\.]+)/);
  if (!match) return null;

  const numerator = parseFloat(match[1].replace(",", "."));
  const denominator = parseFloat(match[2].replace(",", "."));

  if (isNaN(numerator) || isNaN(denominator) || denominator === 0) {
    return null;
  }

  return { numerator, denominator };
}

/**
 * haal kleur op basis van percentage
 */
function getColorClass(percentage: number): string {
  if (percentage >= 75) return "sg-percentage--high";
  if (percentage >= 60) return "sg-percentage--medium";
  if (percentage >= 50) return "sg-percentage--low";
  return "sg-percentage--fail";
}

function injectCoursePercentages() {
  injectStyles();

  const courseRows = document.querySelectorAll(".row--course");
  let injectedCount = 0;

  let overallNumerator = 0;
  let overallDenominator = 0;
  let totalRowElement: HTMLElement | null = null;

  const parentSubjects = new Map<string, { rows: HTMLElement[] }>();

  const rowsData: Array<{ element: HTMLElement, name: string, indentation: number }> = [];

  for (const row of courseRows) {
    const rowElement = row as HTMLElement;
    const courseNameElement = row.querySelector(".cell__course-name");
    if (!courseNameElement) continue;

    const courseName = courseNameElement.getAttribute("aria-label");
    if (!courseName) continue;

    const iconElement = courseNameElement.parentElement?.querySelector(".cell__icon") as HTMLElement | null;
    const indentationStyle = iconElement?.getAttribute("style") || "";
    const indentationMatch = indentationStyle.match(/--indentation:\s*(\d+)/);
    const indentation = indentationMatch?.[1] ? parseInt(indentationMatch[1]) : 0;

    rowsData.push({ element: rowElement, name: courseName, indentation });
  }

  for (let i = 0; i < rowsData.length; i++) {
    const { element: rowElement, name: courseName, indentation } = rowsData[i];

    if (rowElement.querySelector(".sg-percentage-cell")) {
      continue;
    }

    const isTotalRow = courseName === "TOTAALPERCENTAGE";
    if (isTotalRow) {
      totalRowElement = rowElement;
      continue;
    }

    const evaluationCells = rowElement.querySelectorAll(".cell--evaluation");

    let isParent = false;
    const childRows: HTMLElement[] = [];

    if (i + 1 < rowsData.length && rowsData[i + 1].indentation > indentation) {
      isParent = true;
      for (let j = i + 1; j < rowsData.length; j++) {
        if (rowsData[j].indentation > indentation) {
          childRows.push(rowsData[j].element);
        } else {
          break;
        }
      }
    }

    if (isParent && evaluationCells.length === 0) {
      parentSubjects.set(courseName, { rows: childRows });
      continue;
    }

    if (evaluationCells.length === 0) {
      continue;
    }

    let totalNumerator = 0;
    let totalDenominator = 0;
    let scoreCount = 0;

    for (const cell of evaluationCells) {
      const graphicText = cell.querySelector(".graphic__text");
      if (!graphicText) continue;

      const titleText = graphicText.getAttribute("title");
      if (!titleText) continue;

      const score = parseScore(titleText);
      if (score) {
        totalNumerator += score.numerator;
        totalDenominator += score.denominator;
        scoreCount++;

        overallNumerator += score.numerator;
        overallDenominator += score.denominator;
      }
    }

    if (totalDenominator > 0) {
      const percentage = (totalNumerator / totalDenominator) * 100;

      const courseNameElement = rowElement.querySelector(".cell__course-name");
      if (courseNameElement && !courseNameElement.querySelector(".sg-inline-percentage")) {
        const inlinePercentage = document.createElement("span");
        inlinePercentage.className = `sg-inline-percentage ${getColorClass(percentage)}`;
        inlinePercentage.textContent = ` (${percentage.toFixed(1)}%)`;
        inlinePercentage.title = `${totalNumerator.toFixed(1)}/${totalDenominator} = ${percentage.toFixed(1)}% (${scoreCount} evaluaties)`;
        courseNameElement.appendChild(inlinePercentage);
      }
      injectedCount++;
    }
  }

  for (const [parentName, { rows: childRows }] of parentSubjects) {
    let parentNumerator = 0;
    let parentDenominator = 0;

    for (const childRow of childRows) {
      const evaluationCells = childRow.querySelectorAll(".cell--evaluation");

      for (const cell of evaluationCells) {
        const graphicText = cell.querySelector(".graphic__text");
        if (!graphicText) continue;

        const titleText = graphicText.getAttribute("title");
        if (!titleText) continue;

        const score = parseScore(titleText);
        if (score) {
          parentNumerator += score.numerator;
          parentDenominator += score.denominator;
        }
      }
    }

    if (parentDenominator > 0) {
      const percentage = (parentNumerator / parentDenominator) * 100;

      const parentRow = Array.from(courseRows).find(row => {
        const nameEl = row.querySelector(".cell__course-name");
        return nameEl?.getAttribute("aria-label") === parentName;
      });
      if (parentRow) {
        const courseNameElement = parentRow.querySelector(".cell__course-name");
        if (courseNameElement && !courseNameElement.querySelector(".sg-inline-percentage")) {
          const inlinePercentage = document.createElement("span");
          inlinePercentage.className = `sg-inline-percentage ${getColorClass(percentage)}`;
          inlinePercentage.textContent = ` (${percentage.toFixed(1)}%)`;
          inlinePercentage.title = `${parentName}: ${parentNumerator.toFixed(1)}/${parentDenominator} = ${percentage.toFixed(1)}%`;
          courseNameElement.appendChild(inlinePercentage);
        }
      }
      injectedCount++;
    }
  }

  if (totalRowElement && overallDenominator > 0) {
    const totalPercentage = (overallNumerator / overallDenominator) * 100;

    const totalCourseNameElement = totalRowElement.querySelector(".cell__course-name");
    if (totalCourseNameElement && !totalCourseNameElement.querySelector(".sg-inline-percentage")) {
      const inlinePercentage = document.createElement("span");
      inlinePercentage.className = `sg-inline-percentage sg-inline-percentage--total ${getColorClass(totalPercentage)}`;
      inlinePercentage.textContent = ` (${totalPercentage.toFixed(1)}%)`;
      inlinePercentage.title = `Totaal: ${overallNumerator.toFixed(1)}/${overallDenominator} = ${totalPercentage.toFixed(1)}%`;
      totalCourseNameElement.appendChild(inlinePercentage);
    }
  }

  console.log(`% berekend voor ${injectedCount} vakken + totaal`);
}

function injectStyles() {
  if (document.getElementById("smartschool-grid-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "smartschool-grid-styles";
  style.textContent = `
    /* Inline percentage next to course names */
    .sg-inline-percentage {
      font-weight: 700;
      font-size: 13px;
      margin-left: 6px;
    }

    .sg-inline-percentage--total {
      font-size: 14px;
      font-weight: 800;
    }

    .sg-inline-percentage.sg-percentage--high {
      color: #2e7d32;
    }

    .sg-inline-percentage.sg-percentage--medium {
      color: #e65100;
    }

    .sg-inline-percentage.sg-percentage--low {
      color: #c2185b;
    }

    .sg-inline-percentage.sg-percentage--fail {
      color: #c62828;
    }
  `;

  document.head.appendChild(style);
}

init();

console.log("smsG inited!");