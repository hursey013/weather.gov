import { expect } from "chai";
import dayjs from "dayjs";
import sinon, { createSandbox } from "sinon";
import AFDParser from "./AFDParser.js";

describe("AFDParser Tests", () => {

  describe("Static helper tests", () => {
    describe("#normalizeSpaces", () => {
      it("compresses consecutive spaces to single spaces in simple example", () => {
        const example = "this    word   has  multiple spaces  between     others   ";
        const expected = "this word has multiple spaces between others ";
        const actual = AFDParser.normalizeSpaces(example);

        expect(actual).to.equal(expected);
      });
    });

    describe("#splitIntoTopicSections", () => {
      it("can split into topic sections by && (from directive)", () => {
        const example = "\n\n.SYNOPSIS...\nA slow moving cold front sags southeast into the area today, \nstalling nearby through tonight.\n\n&&\n\n.NEAR TERM /THROUGH TONIGHT/...\nA severe thunderstorm watch is in effect until 1100 PM EDT for \nportions of the lower Hudson Valley.\n\n&&\n\n";
        const expected = [
          ".SYNOPSIS...\nA slow moving cold front sags southeast into the area today, \nstalling nearby through tonight.\n\n",
          "\n.NEAR TERM /THROUGH TONIGHT/...\nA severe thunderstorm watch is in effect until 1100 PM EDT for \nportions of the lower Hudson Valley.\n\n"
        ];
        const actual = AFDParser.splitIntoTopicSections(example);

        expect(actual).to.eql(expected);
      });
    });
  });

  describe("Parser method tests", () => {
    describe("#parseDocumentPreamble", () => {
      it("can parse a basic example", () => {
        const example = "\n000\nFXUS61 KALY 051129\nAFDALY\n\nAREA FORECAST DISCUSSION\nNational Weather Service Albany NY\n729 AM EDT Thu Sep 5 2024\n\n.ANY HEADER HERE\n\nMore text here";
        const expectedNodes = [
          {
            type: "preambleCode",
            content: "000\nFXUS61 KALY 051129\nAFDALY"
          },
          {
            type: "preambleText",
            content: "AREA FORECAST DISCUSSION\nNational Weather Service Albany NY\n729 AM EDT Thu Sep 5 2024"
          }
        ];
        const expectedReturnValue = ".ANY HEADER HERE\n\nMore text here";
        const parser = new AFDParser(example);
        const actualReturnValue = parser.parseDocumentPreamble();
        const actualNodes = parser.parsedNodes;

        expect(actualNodes).to.eql(expectedNodes);
        expect(actualReturnValue).to.eql(expectedReturnValue);
      });
    });
    describe("#parseHeader", () => {
      describe("WWA header", () => {
        const example = ".OKX WATCHES/WARNINGS/ADVISORIES...\nSomething else\nAnd more";
        it("parses a header node", () => {
          const parser = new AFDParser();
          parser.parseHeader(example);
          const expected = {
            type: "header",
            content: "OKX WATCHES/WARNINGS/ADVISORIES"
          };
          const actual = parser.parsedNodes.pop();

          expect(actual).to.eql(expected);
        });

        it("sets the correct content type on the parser", () => {
          const parser = new AFDParser();
          parser.parseHeader(example);
          const expected = "wwa";
          const actual = parser.contentType;

          expect(actual).to.eql(expected);
        });

        it("returns the correct substring", () => {
          const parser = new AFDParser();
          const expected = "\nSomething else\nAnd more";
          const actual = parser.parseHeader(example);

          expect(actual).to.eql(expected);
        });
      });

      describe("Temps/Pops", () => {
        const example = ".PRELIMINARY POINT TEMPS/POPS...And some other stuff\nHere too!";
        it("parses a header node", () => {
          const parser = new AFDParser();
          parser.parseHeader(example);
          const expected = {
            type: "header",
            content: "PRELIMINARY POINT TEMPS/POPS"
          };
          const actual = parser.parsedNodes.pop();

          expect(actual).to.eql(expected);
        });

        it("sets the correct content type", () => {
          const parser = new AFDParser();
          parser.parseHeader(example);
          const expected = "tempsTable";
          const actual = parser.contentType;

          expect(actual).to.eql(expected);
        });

        it("returns the correct substring", () => {
          const parser = new AFDParser();
          const expected = "And some other stuff\nHere too!";
          const actual = parser.parseHeader(example);

          expect(actual).to.eql(expected);
        });
      });

      describe("Generic", () => {
        const example = ".THIS IS A GENERIC HEADER...with some stuff after it";
        it("parses a header node", () => {
          const parser = new AFDParser();
          parser.parseHeader(example);
          const expected = {
            type: "header",
            content: "THIS IS A GENERIC HEADER"
          };
          const actual = parser.parsedNodes.pop();

          expect(actual).to.eql(expected);
        });

        it("sets the correct content type", () => {
          const parser = new AFDParser();
          parser.parseHeader(example);
          const expected = "generic";
          const actual = parser.contentType;

          expect(actual).to.eql(expected);
        });

        it("returns the correct substring", () => {
          const parser = new AFDParser();
          const expected = "with some stuff after it";
          const actual = parser.parseHeader(example);

          expect(actual).to.eql(expected);
        });
      });
    });
    describe("#parseSubheader", () => {
      describe("Working example", () => {
        const example = "...This is some subheader stuff here...\nThen some stuff after";
        it("appends a subheader node", () => {
          const parser = new AFDParser();
          parser.parseSubheader(example);
          const expected = {
            type: "subheader",
            content: "This is some subheader stuff here"
          };
          const actual = parser.parsedNodes.pop();

          expect(actual).to.eql(expected);
        });

        it("returns the correct substring", () => {
          const parser = new AFDParser();
          const expected = "\nThen some stuff after";
          const actual = parser.parseSubheader(example);

          expect(actual).to.equal(expected);
        });
      });

      describe("Incorrect example", () => {
        const example = "..Some incorrect subheader...\nThen other stuff";
        it("does not append a subheader node", () => {
          const parser = new AFDParser();
          parser.parseSubheader(example);
          const expected = 0;
          const actual = parser.parsedNodes.length;

          expect(actual).to.equal(expected);
        });

        it("returns the correct substring (the full original string)", () => {
          const parser = new AFDParser();
          const expected = example;
          const actual = parser.parseSubheader(example);

          expect(actual).to.equal(expected);
        });
      });
    });
    describe("#parseTempsTableContent", () => {
      describe("Basic example", () => {
        const example = `Place A   1 2 3 4 / 5 6 7 8\nPlace B   0 9  8 7 / 6   5 4  3`;
        it("can parse the correct table nodes", () => {
          const parser = new AFDParser();
          parser.parseTempsTableContent(example);
          const expected = [
            {
              type: "temps-table",
              rows: [
                {
                  type: "temps-table-row",
                  numbers: ["1", "2", "3", "4", "5", "6", "7", "8"],
                  name: "Place A"
                },
                {
                  type: "temps-table-row",
                  numbers: ["0", "9", "8", "7", "6", "5", "4", "3"],
                  name: "Place B"
                }
              ]
            }
          ];
          const actual = parser.parsedNodes;

          expect(actual).to.eql(expected);
        });
      });
      describe("Example with post-table text", () => {
        let example = "Place A   1 2 3 4 / 5 6 7 8\nPlace B   0 9  8 7 / 6   5 4  3";
        example += "\nSome additional text down here\nAnd more here";
        it("parses the text node separately", () => {
          const parser = new AFDParser();
          parser.parseTempsTableContent(example);
          const expected = {
            type: "text",
            content: "Some additional text down here\nAnd more here"
          };
          const actual = parser.parsedNodes.pop();

          expect(actual).to.eql(expected);
        });
      });
    });
    describe("#parseWWAContent", () => {
      let example = "CT...Some text here that will overflow into\n    the next line\n";
      example += "NJ...None\n";
      example += "NY...Some text here";
      describe("Basic example", () => {
        it("parses the correct node with extra spacing removed", () => {
          const parser = new AFDParser();
          parser.parseWWAContent(example);
          const expected = {
            type: "text",
            content:"CT...Some text here that will overflow into\nthe next line\nNJ...None\nNY...Some text here"
          };
          const actual = parser.parsedNodes.pop();

          expect(actual).to.eql(expected);
        });
      });
    });
  });

  describe("Example tests", () => {
    it("Correctly parses full example", () => {
      let example = "\n";
      example += "000\n";
      example += "FXUS61 KOKX 071443\n";
      example += "AFDOKX\n";
      example += "\n";
      example += "Area Forecast Discussion\n";
      example += "National Weather Service New York NY\n";
      example += "1043 AM EDT Wed Aug 7 2024\n";
      example += "\n";
      example += ".SYNOPSIS...\n";
      example +=
        "A nearly stationary front will remain near the coast through \n";
      example +=
        "Thursday. The front will then return northward Thursday night\n";
      example += "into Friday. \n";
      example += "\n";
      example +=
        "Please refer to the latest official forecast on Debby from the \n";
      example += "National Hurricane Center.\n";
      example += "\n";
      example += "&&\n";
      example += "\n";
      example += ".NEAR TERM /THROUGH TONIGHT/...\n";
      example +=
        "Forecast mainly on track. Much cooler air mass has worked into the \n";
      example += "region with the stationary front just of the of the area.\n";
      example += "\n\n ...NY Metro (KEWR/KLGA/KJFK/KTEB) TAF Uncertainty...\n";
      example +=
        "High pressure builds down from the north into tonight, which will \n";
      example +=
        "only reinforce some of the lower level cooler and drier air. \n";
      example += "\n";
      example += ".OKX WATCHES/WARNINGS/ADVISORIES...\n";
      example += "CT...None.\n";
      example += "NY...None.\n";
      example += "NJ...None.\n";
      example +=
        "MARINE...Small Craft Advisory until 11 PM EDT this evening for ANZ350-\n";
      example += "                353-355.\n";
      example += "\n";
      example += "            &&\n";
      example += "\n";
      example += "        $\n";
      example += "\n";
      example += "        SYNOPSIS...JT/DW\n";
      example += "        NEAR TERM...DS/DW\n";
      example += "        SHORT TERM...DW\n";
      example += "        LONG TERM...JT\n";
      example += "        MARINE...JT/DW \n";
      example += "        HYDROLOGY...JT/DW \n";
      example += "        TIDES/COASTAL FLOODING...\n";

      const expected = [
        {
          type: "preambleCode",
          content: "000\nFXUS61 KOKX 071443\nAFDOKX",
        },
        {
          type: "preambleText",
          content:
          "Area Forecast Discussion\nNational Weather Service New York NY\n1043 AM EDT Wed Aug 7 2024",
        },
        {
          type: "header",
          content: "SYNOPSIS",
        },
        {
          type: "text",
          content:
          "A nearly stationary front will remain near the coast through" +
            " Thursday. The front will then return northward Thursday night into Friday.",
        },
        {
          type: "text",
          content:
          "Please refer to the latest official forecast on Debby from the National Hurricane Center.",
        },
        {
          type: "header",
          content: "NEAR TERM /THROUGH TONIGHT/"
        },
        {
          type: "text",
          content:
          "Forecast mainly on track. Much cooler air mass has worked into the " +
            "region with the stationary front just of the of the area.",
        },
        {
          type: "subheader",
          content: "NY Metro (KEWR/KLGA/KJFK/KTEB) TAF Uncertainty",
        },
        {
          type: "text",
          content:
          "High pressure builds down from the north into tonight, which will " +
            "only reinforce some of the lower level cooler and drier air.",
        },
        {
          type: "header",
          content:
          "OKX WATCHES&hairsp;/&hairsp;WARNINGS&hairsp;/&hairsp;ADVISORIES"
        },
        {
          type: "text",
          content:
          "CT...None.\nNY...None.\nNJ...None.\nMARINE" +
            "...Small Craft Advisory until 11 PM EDT " +
            "this evening for ANZ350-353-355.",
        },
        {
          type: "epilogueText",
          content:
          "SYNOPSIS...JT/DW\nNEAR TERM...DS/DW\nSHORT" +
            " TERM...DW\nLONG TERM...JT\nMARINE..." +
            "JT/DW\nHYDROLOGY...JT/DW\nTIDES/COASTAL FLOODING...",
        },
      ];

      const parser = new AFDParser(example);
      parser.parse();
      const actual = parser.parsedNodes;

      expect(actual).to.eql(expected);
    });
  });
});
