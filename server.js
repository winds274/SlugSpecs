const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 7479;

const drinksFile = path.join(__dirname, "specs.json");
const usersFile = path.join(__dirname, "users.json");
const brunchesFile = path.join(__dirname, "brunches.json");
const imagesDir = path.join(__dirname, "Images");

// Ensure Images folder exists
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

// Ensure specs.json exists
if (!fs.existsSync(drinksFile)) {
  fs.writeFileSync(drinksFile, "{}");  // empty object
}

// Ensure users and brunches.json exists
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, "[]");
}

if (!fs.existsSync(brunchesFile)) {
  fs.writeFileSync(brunchesFile, "[]");
}

// Admin locks
const basicAuth = require('express-basic-auth');

// Define admin credentials
const adminUsers = {
  "admin": "Slug123",
};

// Protect the admin pages
app.use(['/modify.html', '/modifyCalculator.html'], basicAuth({
  users: adminUsers,
  challenge: true, // prompts browser login popup
  unauthorizedResponse: (req) => "Unauthorized"
}));


// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imagesDir),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname)
});
const upload = multer({ storage });

// Serve static files
app.use(express.static(__dirname));
app.use(express.json());

// Calculator Pullthrough
app.post("/save-calculator-json", (req, res) => {
  const filePath = path.join(__dirname, "calculator.json");
  const data = req.body;

  fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8", (err) => {
    if (err) {
      console.error("Error writing calculator.json:", err);
      return res.status(500).send("Failed to save JSON");
    }
    res.send("Saved successfully");
  });
});

// Create Backup
app.post("/save-calculator-json", (req, res) => {
  const filePath = path.join(__dirname, "calculator.json");
  const data = req.body;

  // Create a backup first
  const backupPath = path.join(
    __dirname,
    "backups",
    `calculator-backup-${Date.now()}.json`
  );

  // Ensure backups folder exists
  fs.mkdir(path.join(__dirname, "backups"), { recursive: true }, (err) => {
    if (err) console.error("Error creating backups folder:", err);

    // Copy current JSON to backup
    fs.copyFile(filePath, backupPath, (err) => {
      if (err) console.error("Error creating backup:", err);

      // Now save the new data
      fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8", (err) => {
        if (err) {
          console.error("Error writing calculator.json:", err);
          return res.status(500).send("Failed to save JSON");
        }
        res.send("Saved successfully (backup created)");
      });
    });
  });
});



// Load drinks
function loadDrinks() {
  return JSON.parse(fs.readFileSync(drinksFile, "utf-8") || "{}");
}

// Save drinks
function saveDrinks(drinks) {
  fs.writeFileSync(drinksFile, JSON.stringify(drinks, null, 2));
}

function loadUsers() {
  return JSON.parse(fs.readFileSync(usersFile, "utf-8") || "[]");
}

function saveUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

function loadBrunches() {
  return JSON.parse(fs.readFileSync(brunchesFile, "utf-8") || "[]");
}

function saveBrunches(brunches) {
  fs.writeFileSync(brunchesFile, JSON.stringify(brunches, null, 2));
}

// Add a new drink
app.post("/addDrink", upload.single("image"), (req, res) => {
  const { name, ingredients } = req.body;
  if (!name || !ingredients) return res.status(400).send("Missing data");

  const drinks = loadDrinks();
  drinks[name] = {
    image: req.file ? req.file.filename : null,
    ingredients: JSON.parse(ingredients)
  };

  saveDrinks(drinks);
  res.sendStatus(200);
});

// Remove a drink
app.delete("/removeDrink/:name", (req, res) => {
  const name = req.params.name;
  const drinks = loadDrinks();
  if (!drinks[name]) return res.status(404).send("Not found");

  // Optionally delete image too
  if (drinks[name].image) {
    const imgPath = path.join(imagesDir, drinks[name].image);
    if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  }

  delete drinks[name];
  saveDrinks(drinks);
  res.sendStatus(200);
});

app.get("/users", (req, res) => {
  res.json(loadUsers());
});

app.post("/users", (req, res) => {
  const users = loadUsers();

  const { name } = req.body;

  if (!name) {
    return res.status(400).send("Missing name");
  }

  if (!users.includes(name)) {
    users.push(name);
    saveUsers(users);
  }

  res.json(users);
});

app.get("/brunches", (req, res) => {

  const user = req.query.user;

  const brunches = loadBrunches();

  const filtered = brunches.filter(
    brunch => brunch.user === user
    );

  res.json(filtered);

});

app.post("/brunches", (req, res) => {
  const brunches = loadBrunches();

  const { table, user } = req.body;

  if (!table || !user) {
    return res.status(400).send("Missing data");
  }

  const brunch = {
    id: Date.now(),
    table,
    user,
    endTime: Date.now() + (2 * 60 * 60 * 1000)
  };

  brunches.push(brunch);

  saveBrunches(brunches);

  res.json(brunch);
});

app.delete("/brunches/:id", (req, res) => {

    const id = Number(req.params.id);

    let brunches = loadBrunches();

    brunches = brunches.filter(
        brunch => brunch.id !== id
    );

    saveBrunches(brunches);

    res.json(brunches);

});

setInterval(() => {
  const brunches = loadBrunches();

  const active = brunches.filter(
    brunch => brunch.endTime > Date.now()
  );

  saveBrunches(active);

}, 60000);

app.listen(PORT, () => {
  console.log(`Server running at on port ${PORT}`);
});

