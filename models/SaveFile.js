const mongoose = require("mongoose");

const SaveFileSchema = new mongoose.Schema({});

const SaveFile = mongoose.model("SaveFile", SaveFileSchema, "SaveFiles");

module.exports = SaveFile;
