const express = require("express");
const path = require("path");
const fs = require("fs");
const { Transform } = require("stream");
const util = require("util");
const appendFile = util.promisify(fs.appendFile);
const app = express();
app.use(express.json());
const axios = require("axios");
const FormData = require("form-data");

const appendStream = fs.createWriteStream("./data/data.json", { flags: "a" });
const { schools, years } = require("./getData");

//optional for front end
// app.use(express.static(path.resolve(__dirname, "./frontend/build")));

// app.get("/", (req, res) => {
//   res.sendFile(path.join(__dirname, "./frontend/build", "index.html"));
// });

async function getData(rows, page, school, i, year, j, schoolData) {
  return new Promise((resolve, reject) => {
    let data = new FormData();
    data.append("_search", "false");
    data.append("nd", "1693609828178");
    data.append("rows", rows);
    data.append("page", page);
    data.append("sidx", "EAW_GRS_EARN_AMT");
    data.append("sord", "desc");
    data.append("year", year);
    data.append("location", school);

    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://ucannualwage.ucop.edu/wage/search.action",
      headers: {
        Cookie: "JSESSIONID=0000H5l-s83LwUsRWFvQTLAqqMj:168lpmkau",
      },
      data: data,
    };

    let responseText = "";

    axios
      .request(config)
      .then((response) => {
        responseText = response.data.replace(/'/g, '"');
        responseText = responseText.replace(/[^\x20-\x7E]+/g, "");
        const parsedData = JSON.parse(responseText);
        resolve(parsedData.rows);
      })
      .catch((error) => {
        console.log(error);
        reject({ message: "error" });
      });
  });
}

app.get("/testing", (req, res) => {
  res.send("hello world");
});

app.post("/writejson", async (req, res) => {
  try {
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

    for (let i = 0; i < schools.length; i++) {
      const schoolName = schools[i];

      const schoolIndex = existingData.findIndex(
        (item) => item.name === schoolName
      );

      if (schoolIndex === -1) {
        // Create a new school object and add it to the existingData array

        const newSchool = {
          name: schoolName,
          years: [],
        };

        existingData.push(newSchool);

        // Write the updated existingData array back to the JSON file immediately
        for (let j = 0; j < years.length; j++) {
          console.log("addeding year object");

          existingData[i].years.push({
            year: years[j],
            payrolls: [],
          });
        }
      } else {
        // School with the same name already exists, check if the year exists
        for (let j = 0; j < years.length; j++) {
          const year = years[j];

          const yearExists = existingData[schoolIndex].years.some(
            (item) => item.year === year
          );

          if (!yearExists) {
            console.log("addeding year object");
            // Year doesn't exist, add a new year object
            existingData[schoolIndex].years.push({
              year: year,
              payrolls: [],
            });
          }
        }
      }
    }

    // Define a recursive function to iterate through the data
    async function processSchoolYears(existingData, i, j) {
      if (i >= existingData.length) {
        // All schools and years processed, exit recursion
        return;
      }

      const school = existingData[i];
      const year = school.years[j];
      if (year.payrolls.length > 0) {
        console.log("Payrolls already exist, skip this year");
      } else {
        console.log("Payrolls don't exist, fetch them");
        let rows = 1000;
        let page = 1;
        const maxPage = 100;

        for (let k = 0; k < maxPage; k++) {
          const data = await getData(
            rows,
            page,
            school.name,
            i,
            year.year,
            j,
            existingData
          );

          const processedData = data.map((item) => ({
            id: item.id,
            cell: [item.cell[4], item.cell[6]],
          }));

          // Find the corresponding school and year in existingData
          const targetSchool = existingData.find(
            (item) => item.name === school.name
          );
          if (targetSchool) {
            const targetYear = targetSchool.years.find(
              (item) => item.year === year.year
            );
            if (targetYear) {
              targetYear.payrolls = targetYear.payrolls.concat(processedData);
            }
          }

          if (data.length === 0) {
            console.log("end of data stream");
            break;
          }

          page++;
        }
      }

      // Move to the next year or school
      if (j + 1 < school.years.length) {
        // Process the next year
        await processSchoolYears(existingData, i, j + 1);
      } else if (i + 1 < existingData.length) {
        // Move to the next school and reset year index
        await processSchoolYears(existingData, i + 1, 0);
      }
    }

    // Start processing the data
    await processSchoolYears(existingData, 0, 0);

    // Write the updated data to the file after all processing is done
    const appendData = JSON.stringify(existingData, null, 2);
    fs.writeFileSync(filePath, appendData);

    res.send("done");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error fetching data" });
  }
});

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

process.on("SIGINT", () => {
  appendStream.end(() => {
    process.exit(0);
  });
});

const port = process.env.PORT || 443;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
