const { By, Builder, Browser } = require("selenium-webdriver");
const assert = require("assert");

(async function singlePageApplicationIsAccessible() {
  const { Device } = await import("@siteimprove/alfa-device");
  const { Document } = await import("@siteimprove/alfa-dom");
  const { Native } = await import("@siteimprove/alfa-dom/native");
  const { Request, Response } = await import("@siteimprove/alfa-http");
  const { Page } = await import("@siteimprove/alfa-web");
  const { Map } = await import("@siteimprove/alfa-map");
  const { Sequence } = await import("@siteimprove/alfa-sequence");
  const { Outcome } = await import("@siteimprove/alfa-act");
  const { Audit, Logging } = await import("@siteimprove/alfa-test-utils");

  let driver;

  try {
    driver = new Builder().forBrowser(Browser.CHROME).build();
    await driver.get("http://localhost:8080");

    let title = await driver.getTitle();
    assert.equal("Code Checker Example: SPA", title);

    console.log("Running Code Checker on first screen");
    const alfaResultScreen1 = await testAccessibility();
    Logging.result(alfaResultScreen1);

    await driver.manage().setTimeouts({ implicit: 2000 });

    let petNameInput = await driver.findElement(By.id("petName"));
    let nextButton = await driver.findElement(
      By.xpath('//button[text()="Next"]'),
    );

    await petNameInput.sendKeys("Fido");
    await nextButton.click();

    console.log("Running Code Checker on second screen");
    const alfaResultScreen2 = await testAccessibility();

    const diff1 = getResultDiff(alfaResultScreen1, alfaResultScreen2);
    Logging.result(diff1);

    let favMovieInput = await driver.findElement(By.id("favMovie"));
    favMovieInput.sendKeys("The Good, the Bad and the Ugly");

    let submitButton = await driver.findElement(By.id("submit"));
    await submitButton.click();

    let summary = await driver.findElement(By.id("summary"));

    let value = await summary.getText();
    assert.equal(
      "Pet's Name: Fido\nFavorite Movie: The Good, the Bad and the Ugly",
      value,
    );

    // Hover mouse over restart button
    let restartButton = await driver.findElement(
      By.xpath('//button[text()="Restart"]'),
    );
    const actions = driver.actions({ async: true });
    await actions.move({ origin: restartButton }).perform();

    console.log("Running Code Checker on third screen");
    const alfaResultScreen3 = await testAccessibility();
    const diff2 = getResultDiff(alfaResultScreen1, alfaResultScreen3);
    Logging.result(diff2);
  } catch (e) {
    console.log(e);
  } finally {
    await driver.quit();
  }

  async function testAccessibility() {
    const document = await driver.executeScript("return document;");
    const documentJSON = await driver.executeScript(Native.fromNode, document);
    const device = Device.standard();
    const alfaPage = Page.of(
      Request.empty(),
      Response.empty(),
      Document.from(documentJSON, device),
      device,
    );

    return Audit.run(alfaPage);
  }

  function getResultDiff(previous, current) {
    const outcomesDiff = [];

    for (let [rule, outcomes] of current.outcomes) {
      const oldOutcomes = previous.outcomes.get(rule);
      if (oldOutcomes.isSome()) {
        const newOutcomes = outcomes.filter((outcome) =>
          oldOutcomes.get().every((oldOutcome) => !oldOutcome.equals(outcome)),
        );

        if (Sequence.isCons(newOutcomes)) {
          outcomesDiff.push([rule, newOutcomes]);
        }
      }
    }

    const outcomes = Map.from(outcomesDiff);
    return {
      alfaVersion: current.alfaVersion,
      page: current.page,
      outcomes,
      resultAggregates: outcomes
        .map((ruleOutcomes) =>
          ruleOutcomes.groupBy((outcome) => outcome.outcome),
        )
        .map((groups) => ({
          failed: groups.get(Outcome.Value.Failed).getOrElse(Sequence.empty)
            .size,
          passed: groups.get(Outcome.Value.Passed).getOrElse(Sequence.empty)
            .size,
          cantTell: groups.get(Outcome.Value.CantTell).getOrElse(Sequence.empty)
            .size,
        })),
      durations: current.durations,
    };
  }
})();
