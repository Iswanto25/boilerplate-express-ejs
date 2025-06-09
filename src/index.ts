import express from "express";
import path from "path";

const app = express();
const port = process.env.PORT || 3000;

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));
app.use(express.static(path.join(__dirname, "../public")));

app.get("/", (req, res) => {
	res.render("index", { title: "Hello from TypeScript + EJS!" });
});

app.get("/send", (req, res) => {
	res.send("Hello from the /send route!");
});

app.listen(port, () => {
	console.log(`Server listening on http://localhost:${port}`);
});
