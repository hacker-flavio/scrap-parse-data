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
require("dotenv").config();
const mongoose = require("mongoose");
const dburl = process.env.DBURL;

mongoose.connect(dburl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const mdb = mongoose.connection;
mdb.on("error", (error) => console.error(error));
mdb.once("open", () => console.log("Connected to Mongoose"));

const dir = "./dataFiles";
const filePath = "./dataFiles/data.json";
const indexFilePath = "./dataFiles/indexData.json";
let appendStream;

function createDirAndFile(callback) {
  console.log("Directory and file do not exist");
  console.log("Creating directory and file...");

  fs.mkdir(dir, { recursive: true }, (err) => {
    if (err) {
      console.error("Error creating directory:", err);
    } else {
      console.log("Directory created");

      // Now that the directory exists, create the file
      fs.writeFileSync(filePath, "", "utf-8");
      fs.writeFileSync(indexFilePath, "", "utf-8");
      console.log("Files created");

      callback(); // Call the callback function to indicate completion
    }
  });
}

// Check if directory exists
fs.access(dir, (err) => {
  if (err) {
    createDirAndFile(() => {
      // Callback function to create the appendStream after directory and file creation
      createAppendStream();
    });
  } else {
    console.log("Directory exists");

    // Check if file exists
    fs.access(filePath, (err) => {
      if (err) {
        console.log("File does not exist");
        // You can choose to create the file here if needed
      } else {
        console.log("File exists");

        fs.access(indexFilePath, (err) => {
          if (err) {
            console.log("Index file does not exist");
          } else {
            console.log("Index file exists");

            // Create the appendStream directly if the directory and file already exist
            createAppendStream();
          }
        });
      }
    });
  }
});

function createAppendStream() {
  appendStream = fs.createWriteStream(filePath, {
    flags: "a",
  });
}

const { schools, years, titles } = require("./getData");

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
    const filePath = "./dataFiles/data.json";
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
        // let rows = 20;
        // let page = 1;
        // const maxPage = 1;

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
            cell: [
              `${item.cell[3]} ${item.cell[4]}`,
              item.cell[5],
              item.cell[6],
            ],
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

  const filePath = "./dataFiles/data.json";
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
  const targetName = "JAY SHARPING";
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
        const name = cell[0];
        const splitName = name.split(" ");
        const firstName = splitName[0];
        const lastName = splitName[splitName.length - 1];
        const fullName = firstName + " " + lastName;
        if (fullName === targetName) {
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
    console.log("No matching cells found for: ", targetName);
  }

  res.send(matchingCells);
});

async function indexData(schoolData) {
  return new Promise((resolve, reject) => {
    try {
      const newIndexedData = [];
      for (let i = 0; i < schoolData.length; i++) {
        const school = schoolData[i];
        const schoolObject = {
          name: school.name,
          employees: [],
          years: [],
          employeeList: [],
        };
        newIndexedData.push(schoolObject);
        console.log(schoolObject);
        for (let j = 0; j < school.years.length; j++) {
          const year = school.years[j];
          const yearObject = {
            year: year.year,
            titles: [],
          };
          schoolObject.years.push(yearObject);
          for (let k = 0; k < year.payrolls.length; k++) {
            const payroll = year.payrolls[k];
            const name = payroll.cell[0];
            const splitName = name.split(" ");
            const firstName = splitName[0];
            const lastName = splitName[splitName.length - 1];
            const fullName = firstName + " " + lastName;
            const title = payroll.cell[1];
            const pay = payroll.cell[2];
            const result = title.split(/[\s-]+/);

            const employeeObject = {
              name: fullName,
              titles: result,
              payrolls: [{ year: year.year, salary: pay }],
            };

            const nameIndex = schoolObject.employees.findIndex(
              (item) => item.name === fullName
            );
            if (nameIndex === -1) {
              schoolObject.employees.push(employeeObject);
              schoolObject.employeeList.push(fullName);
            } else {
              schoolObject.employees[nameIndex].payrolls.push({
                year: year.year,
                salary: pay,
              });
            }

            for (let titleIndex = 0; titleIndex < result.length; titleIndex++) {
              const title = result[titleIndex];
              if (titles.includes(title)) {
                //console.log("title found: " + title + " in titles array");

                const titleIndex = schoolObject.years[j].titles.findIndex(
                  (item) => item.title === title
                );

                if (titleIndex === -1) {
                  // Create a new title object and add it to the titles array
                  const newTitle = {
                    title: title,
                    employees: [fullName],
                  };
                  schoolObject.years[j].titles.push(newTitle);
                } else {
                  if (
                    !schoolObject.years[j].titles[
                      titleIndex
                    ].employees.includes(fullName)
                  ) {
                    schoolObject.years[j].titles[titleIndex].employees.push(
                      fullName
                    );
                  }
                }
              }
            }
          }
        }
      }

      resolve(newIndexedData);
    } catch (err) {
      console.log(err);
      reject({ message: "error" });
    }
  });
}

app.get("/indexData", async (req, res) => {
  const filePath = "./dataFiles/data.json";
  let existingData = [];

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    if (fileContent.length !== 0) {
      existingData = JSON.parse(fileContent);
    }
  } catch (err) {
    console.error("Error reading JSON file:", err);
  }

  // Now, save existingData to a different JSON file named indexData.json
  const newIndexFilePath = "./dataFiles/indexData.json";

  const indexDataResolved = await indexData(existingData);

  try {
    fs.writeFileSync(
      newIndexFilePath,
      JSON.stringify(indexDataResolved, null, 2)
    );
    console.log("Existing data saved to indexData.json");
  } catch (err) {
    console.error("Error saving data to indexData.json:", err);
  }

  res.send("Data saved to indexData.json");
});

app.get("/indexEmployee", async (req, res) => {
  const filePath = "./dataFiles/indexData.json";
  let existingData = [];

  try {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    if (fileContent.length !== 0) {
      existingData = JSON.parse(fileContent);
    }
  } catch (err) {
    console.error("Error reading JSON file:", err);
  }

  const schoolNameToFind = "Merced";
  const employeeNameToFind = "JAY SHARPING";

  // Find the school that matches the school name
  const school = existingData.find(
    (school) => school.name === schoolNameToFind
  );

  if (school) {
    // Find the employee within the school
    const employee = school.employees.find(
      (employee) => employee.name === employeeNameToFind
    );

    if (employee) {
      const payrolls = employee.payrolls;
      console.log(
        "Payrolls for",
        employeeNameToFind,
        "at",
        schoolNameToFind,
        ":",
        payrolls
      );
      res.send(payrolls);
    } else {
      console.log("Employee not found in", schoolNameToFind);
    }
  } else {
    console.log("School not found:", schoolNameToFind);
  }
});

// Define an API route for inserting JSON data
app.post("/insertData", async (req, res) => {
  try {
    const jsonFilePath = "./dataFiles/indexData.json"; // Replace with the actual path to your JSON file
    const jsonData = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));

    const collection = mongoose.connection.db.collection("dataFile"); // Replace with your collection name

    await collection.insertMany(jsonData);

    console.log("Data inserted successfully into MongoDB.");
    res.status(200).send("Data inserted successfully into MongoDB.");
  } catch (error) {
    console.error("Error inserting data into MongoDB:", error);
    res.status(500).send("Error inserting data into MongoDB.");
  }
});

app.get("/indexEmployeeMongo", async (req, res) => {
  const { schoolName, employeeName } = req.query;
  // const schoolNameToFind = "Merced";
  // const employeeNameToFind = "ROGELIO CHAVEZ";
  const schoolNameToFind = schoolName;
  const employeeNameToFind = employeeName;

  try {
    const collection = mongoose.connection.db.collection("dataFile"); // Replace with your collection name

    const school = await collection.findOne({ name: schoolNameToFind });

    if (school) {
      const employee = school.employees.find(
        (employee) => employee.name === employeeNameToFind
      );

      if (employee) {
        const payrolls = employee.payrolls;
        console.log(
          "Payrolls for",
          employeeNameToFind,
          "at",
          schoolNameToFind,
          ":",
          payrolls
        );
        res.send(payrolls);
      } else {
        console.log("Employee not found in", schoolNameToFind);
        res.status(404).send("Employee not found");
      }
    } else {
      console.log("School not found:", schoolNameToFind);
      res.status(404).send("School not found");
    }
  } catch (error) {
    console.error("Error retrieving data from MongoDB:", error);
    res.status(500).send("Internal Server Error");
  }
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
