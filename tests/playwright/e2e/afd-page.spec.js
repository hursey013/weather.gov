/* eslint-disable no-await-in-loop, no-plusplus */
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const { describe, beforeEach } = test;

const PRODUCT_PATH = path.resolve(__dirname, "..", "..", "api", "data", "testing", "products");
const OKX_REFERENCES = JSON.parse(
  fs.readFileSync(path.join(PRODUCT_PATH, "types", "AFD", "locations", "OKX.json")).toString()
);
const OVERALL_REFERENCES = JSON.parse(
  fs.readFileSync(path.join(PRODUCT_PATH, "types", "AFD.json")).toString()
);
const firstId = OKX_REFERENCES["@graph"][0].id;

describe("AFD Page Tests", () => {
  describe("Partial HTML routes", () => {
    test("Can retrieve <option> elements html partial for version listing", async ({page}) => {
      await page.goto("http://localhost:8081/play/testing");
      await page.goto("http://localhost:8080/wx/afd/locations/OKX");

      const options = await page.locator('option:first-child');
      await expect(options).toHaveCount(1);

      // Make sure the first option has the same value/id
      // as the one in our test data.
      // See tests/api/data/testing/products/types/AFD/locations/OKX.json
      const val = await options.getAttribute("value");
      await expect(val).toEqual(firstId);
    });

    test("Can retreive html partial for AFD content", async({page}) => {
      await page.goto("http://localhost:8081/play/testing");
      // See tests/api/data/products/
      // This is our OKX first AFD testing example data
      await page.goto(`http://localhost:8080/wx/afd/${firstId}`);

      const article = await page.locator("article");
      await expect(article).toHaveCount(1);

      const id = await article.getAttribute("data-afd-id");
      await expect(id).toEqual(firstId);
    });
  });

  describe("Querystrings and Redirects", () => {
    beforeEach(async ({page}) => {
      await page.goto("http://localhost:8081/play/testing");
    });
    
    test("Hitting /afd without any querystrings will redirect to the most recent anywhere", async ({page}) => {
      const expectedId = OVERALL_REFERENCES["@graph"][0].id;
      await page.goto(`http://localhost:8080/afd`);
      await page.waitForURL(`http://localhost:8080/afd/TAE/${expectedId}`);

      const article = await page.locator("article");
      const actualId = await article.getAttribute("data-afd-id");

      await expect(actualId).toEqual(expectedId);
    });

    test("Hitting /afd with a WFO code querystring will give the most recent for that location", async ({page}) => {
      const expectedId = OKX_REFERENCES["@graph"][0].id;
      await page.goto("http://localhost:8080/afd?wfo=OKX");
      await page.waitForURL(`http://localhost:8080/afd/OKX/${expectedId}`);

      const article = await page.locator("article");
      const actualId = await article.getAttribute("data-afd-id");

      await expect(actualId).toEqual(expectedId);
    });

    test("Hitting /afd with a WFO code and and id as querystrings will give the right afd and selection in dropdown", async ({page}) => {
      const expectedId = OKX_REFERENCES["@graph"][1].id;
      await page.goto(`http://localhost:8080/afd?wfo=OKX&id=${expectedId}`);
      await page.waitForURL(`http://localhost:8080/afd/OKX/${expectedId}`);

      const article = await page.locator("article");
      await expect(article).toHaveCount(1);
      const actualId = await article.getAttribute("data-afd-id");
      const select = await page.locator("form > select#version-selector");
      const selectedId = await select.evaluate(el => el.value);

      await expect(actualId).toEqual(expectedId);
      await expect(selectedId).toEqual(expectedId);
    });
  });

  /**
   * This block of tests deals with the pure server form
   * request (non-JS) version of the component.
   * If we switch to the JS version, we might need to update
   * how these tests run.
   */
  describe("Changing selections tests", () => {
    beforeEach(async ({page}) => {
      await page.goto("http://localhost:8081/play/testing");
      await page.goto("http://localhost:8080/afd/OKX");
    });

    test("Selecting third version and clicking button will load that version", async ({page}) => {
      const thirdId = OKX_REFERENCES["@graph"][2].id;
      const versionSelect = await page.locator('select#version-selector');
      await versionSelect.selectOption(thirdId);

      const button = await page.locator(`form#afd-selection-form > button[type="submit"]`);
      await button.click();

      await page.waitForURL(`http://localhost:8080/afd/OKX/${thirdId}`);

      const article = await page.locator("article");
      const actualId = await article.getAttribute("data-afd-id");
      const updatedSelect = await page.locator('select#version-selector');
      const selectedValue = await updatedSelect.evaluate(el => el.value);
      const wfoSelect = await page.locator('select#wfo-selector');
      const wfoValue = await wfoSelect.evaluate(el => el.value);

      await expect(actualId).toEqual(thirdId);
      await expect(wfoValue).toEqual("OKX");
      await expect(selectedValue).toEqual(thirdId);
    });

    test("Selecting an alternate WFO will update the version selector and document", async ({page}) => {
      const targetId = OVERALL_REFERENCES["@graph"][0].id;
      const wfoSelect = await page.locator("select#wfo-selector");
      await wfoSelect.selectOption("TAE");
      
      const button = await page.locator(`form#afd-selection-form > button[type="submit"]`);
      await button.click();

      const article = await page.locator("article");
      const articleId = await article.getAttribute("data-afd-id");
      const updatedSelect = await page.locator("select#wfo-selector");
      const selectedWFO = await updatedSelect.evaluate(el => el.value);
      const versionSelect = await page.locator("select#version-selector");
      const selectedVersion = await versionSelect.evaluate(el => el.value);

      await expect(articleId).toEqual(targetId);
      await expect(selectedWFO).toEqual("TAE");
      await expect(selectedVersion).toEqual(targetId);
    });
  });
});
