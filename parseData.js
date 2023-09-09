const express = require("express");
const app = express();
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const port = 4000;
app.use(express.json());

app.use(
  cors({
    origin: ["http://localhost:3000"],
    credentials: true, // Don't forget to enable credentials
  })
);

const axios = require("axios");

app.get("/parseData", async (req, res) => {
  console.log("request made to server...");

  const filePath = "./data/data.json";
  let existingData = [];

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    if (fileContent.length !== 0) {
      existingData = JSON.parse(fileContent);
    }
  } catch (err) {
    console.error("Error reading JSON file:", err);
  }

  //   const targetName = "TEDFORD";
  //   const matchingCells = [];

  //   // Iterate through the data structure to find matching cells
  //   for (const entry of existingData) {
  //     for (const yearEntry of entry.years) {
  //       for (const payroll of yearEntry.payrolls) {
  //         const cell = payroll.cell;
  //         if (cell[0] === targetName) {
  //           matchingCells.push(cell);
  //         }
  //       }
  //     }
  //   }

  //   if (matchingCells.length > 0) {
  //     console.log("Matching cells for", targetName + ":", matchingCells);
  //   } else {
  //     console.log("No matching cells found for", targetName);
  //   }
  const targetSchool = "Merced";
  const targetName = "KYRILOV";
  const matchingCells = [];
  let foundSchool = false;

  // Iterate through the data structure to find matching cells for the specific school
  for (const entry of existingData) {
    if (foundSchool) {
      // If the school has already been found and processed, break the loop
      break;
    }
    for (const yearEntry of entry.years) {
      for (const payroll of yearEntry.payrolls) {
        const cell = payroll.cell;
        if (cell[0] === targetName) {
          const payRollObejct = {
            year: yearEntry.year,
            payroll: cell,
          };
          matchingCells.push(payRollObejct);
        }
      }
    }
    if (entry.name === targetSchool) {
      foundSchool = true;
    }
  }

  if (matchingCells.length > 0) {
    console.log("Matching cells for", targetName + ":", matchingCells);
  } else {
    console.log("No matching cells found for", targetName);
  }

  res.send(matchingCells);
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
