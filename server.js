const express = require("express")
const sqlite3 = require("sqlite3").verbose()
const geoip = require("geoip-lite")
const UAParser = require("ua-parser-js")

const app = express()
const PORT = 3000

app.use(express.json())

/* DATABASE */

const db = new sqlite3.Database("database.db")

db.run(`
CREATE TABLE IF NOT EXISTS clicks (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 ip TEXT,
 country TEXT,
 city TEXT,
 browser TEXT,
 os TEXT,
 device_type TEXT,
 device_model TEXT,
 screen TEXT,
 pixel_ratio TEXT,
 guessed_device TEXT,
 timestamp TEXT
)
`)

/* GUESS IPHONE MODEL */

function guessIphone(screen, ratio) {

    if (screen === "2556x1179" && ratio == 3)
        return "iPhone 15 / 15 Pro"

    if (screen === "2796x1290" && ratio == 3)
        return "iPhone 15 Pro Max"

    if (screen === "2532x1170" && ratio == 3)
        return "iPhone 13 / 14"

    if (screen === "2436x1125" && ratio == 3)
        return "iPhone X / XS"

    return "Unknown iPhone"
}

/* TRACK PAGE */

app.get("/track", (req, res) => {

    res.send(`
<html>
<head><title>Loading...</title></head>
<body>

<script>

async function sendData(){

const data = {

userAgent:navigator.userAgent,
platform:navigator.platform,
screenWidth:screen.width,
screenHeight:screen.height,
pixelRatio:window.devicePixelRatio

}

await fetch("/collect",{
method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify(data)
})

window.location="https://google.com"

}

sendData()

</script>

</body>
</html>
`)

})

/* COLLECT DEVICE DATA */

app.post("/collect", (req, res) => {

    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress
    const geo = geoip.lookup(ip) || {}

    const parser = new UAParser(req.body.userAgent)
    const result = parser.getResult()

    const browser = result.browser.name || "Unknown"
    const os = result.os.name || "Unknown"
    const deviceType = result.device.type || "desktop"
    const deviceModel = result.device.model || "Unknown"

    const screen = req.body.screenWidth + "x" + req.body.screenHeight
    const ratio = req.body.pixelRatio

    let guessedDevice = "Unknown"

    if (os === "iOS") {
        guessedDevice = guessIphone(screen, ratio)
    }

    db.run(`
INSERT INTO clicks
(ip,country,city,browser,os,device_type,device_model,screen,pixel_ratio,guessed_device,timestamp)

VALUES (?,?,?,?,?,?,?,?,?,?,?)
`,
        [
            ip,
            geo.country || "Unknown",
            geo.city || "Unknown",
            browser,
            os,
            deviceType,
            deviceModel,
            screen,
            ratio,
            guessedDevice,
            new Date().toISOString()
        ])

    res.json({ status: "ok" })

})

/* RAW DATA */

app.get("/logs", (req, res) => {

    db.all("SELECT * FROM clicks ORDER BY id DESC", (err, rows) => {

        if (err) {
            res.status(500).send(err)
            return
        }

        res.json(rows)

    })

})

/* DASHBOARD */

app.get("/dashboard", (req, res) => {

    db.all("SELECT * FROM clicks ORDER BY id DESC", (err, rows) => {

        let html = `
<h2>Visitor Tracker</h2>

<table border="1" cellpadding="8">

<tr>
<th>IP</th>
<th>Country</th>
<th>City</th>
<th>Browser</th>
<th>OS</th>
<th>Device Type</th>
<th>Device Model</th>
<th>Screen</th>
<th>Pixel Ratio</th>
<th>Guessed Device</th>
<th>Time</th>
</tr>
`

        rows.forEach(r => {

            html += `
<tr>
<td>${r.ip}</td>
<td>${r.country}</td>
<td>${r.city}</td>
<td>${r.browser}</td>
<td>${r.os}</td>
<td>${r.device_type}</td>
<td>${r.device_model}</td>
<td>${r.screen}</td>
<td>${r.pixel_ratio}</td>
<td>${r.guessed_device}</td>
<td>${r.timestamp}</td>
</tr>
`

        })

        html += "</table>"

        res.send(html)

    })

})

app.listen(PORT, () => {
    console.log("Tracker running on port " + PORT)
})