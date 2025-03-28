const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");

const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Ensure 'uploads' directory exists
// const uploadDir = path.join(__dirname, "uploads");
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir);
// }

// // Multer setup for file upload
// const storage = multer.diskStorage({
//   destination: (req, file, cb) => {
//     cb(null, uploadDir); // Save files in the 'uploads' folder
//   },
//   filename: (req, file, cb) => {
//     cb(null, `${Date.now()}-${file.originalname}`);
//   },
// });

// const upload = multer({ storage: storage });

const uri = `mongodb+srv://mosque:sbyNKmyqwu0mRIRg@cluster0.xk69pxb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    const donationCollection = client.db("mosque").collection("donation");
    const approveDonationCollection = client
      .db("mosque")
      .collection("approveDonation");
    const memberCollection = client.db("mosque").collection("member");
    const noticeCollection = client.db("mosque").collection("notice");
    const comitteeCollection = client.db("mosque").collection("comittee");
    const eventCollection = client.db("mosque").collection("event");
    const vlogCollection = client.db("mosque").collection("vlog");
    const loginCollection = client.db("mosque").collection("login");

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "meherabintejar@gmail.com",
        pass: "ykmbzqgwlghipnju",
      },
    });

    app.post("/approveDonation", async (req, res) => {
      const data = req.body;
      if (!data) {
        return res.status(400).send({ error: "Payload is missing or invalid" });
      }
      const result = await approveDonationCollection.insertOne(data);
      res.send(result);
    });
    app.post("/donation", async (req, res) => {
      const data = req.body;
      if (!data) {
        return res.status(400).send({ error: "Payload is missing or invalid" });
      }
      const result = await donationCollection.insertOne(data);
      res.send(result);
    });

    app.get("/allDonation", async (req, res) => {
      const result = await donationCollection.find({}).toArray();
      res.send(result);
    });
    app.get("/allApproveDonation", async (req, res) => {
      const result = await approveDonationCollection.find({}).toArray();
      res.send(result);
    });

    // Send email with attached PDF
    app.post("/sendEmail", upload.single("pdf"), async (req, res) => {
      console.log("in", req.body);
      const { email, name, id } = req.body;
      const pdfPath = req.file.path;

      const user = await approveDonationCollection.findOne({ email });
      if (!user) return res.status(404).send("User not found");

      const mailOptions = {
        from: "mohammodiabaria@gmail.com",
        to: email,
        subject: "Donation Certificate",
        text: `Dear ${name},\n\nThank you for your generous donation. Please find your receipt and certificate attached.\n\nBest regards,\nDonation Team`,
        attachments: [{ filename: "DonationCertificate.pdf", path: pdfPath }],
      };

      transporter.sendMail(mailOptions, async (error, info) => {
        fs.unlinkSync(pdfPath); // Delete the temporary PDF file
        if (error) {
          console.log(error);
          return res
            .status(500)
            .send({ error: "Failed to send email", details: error.toString() });
        }

        // await donationCollection.deleteOne({ id });
        res.send("Email sent and user removed from database.");
      });
    });

    app.post("/addMember", async (req, res) => {
      const data = req.body;
      console.log(data); // Logging to check the data being sent

      // Check if the email is present in the request data
      if (!data.email) {
        return res.status(400).send({ error: "Email is required" });
      }

      try {
        // Check if the user already exists by email
        const existingUser = await memberCollection.findOne({
          email: data.email,
        });
        if (existingUser) {
          // If the user exists, delete their data from both collections
          await memberCollection.deleteOne({ email: data.email });
          await approveDonationCollection.deleteOne({
            transactionId: data.trxId,
          });

          console.log(`Existing user with email ${data.email} deleted.`);
        }

        // Insert the new member data
        await memberCollection.insertOne(data);

        // If insertion is successful, respond with a success message
        res.send({ success: true, message: "Member added successfully." });
      } catch (error) {
        console.error("Error processing request:", error);
        res.status(500).send({
          error: "Failed to process the request",
          details: error.message,
        });
      }
    });
    app.get("/allMember", async (req, res) => {
      const result = await memberCollection.find({}).toArray();
      res.send(result);
    });

    // notice board
    app.post("/notice", async (req, res) => {
      const data = req.body;
      if (!data) {
        return res.status(400).send({ error: "Payload is missing or invalid" });
      }
      const result = await noticeCollection.insertOne(data);
      res.send(result);
    });

    app.get("/allNotice", async (req, res) => {
      const result = await noticeCollection.find({}).toArray();
      res.send(result);
    });
    app.put("/updateNotice/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedData = req.body;

      // Assuming updatedData contains the fields you want to update.
      const updateDoc = {
        $set: updatedData, // Use $set to specify fields to update
      };

      try {
        const result = await noticeCollection.updateOne(filter, updateDoc, {
          upsert: true,
        });
        res.send(result);
      } catch (err) {
        res.status(500).send({ error: err.message });
      }
    });

    app.delete("/deleteNotice/:id", async (req, res) => {
      const { id } = req.params;
      try {
        const result = await noticeCollection.deleteOne({
          _id: new ObjectId(id),
        });
        if (result.deletedCount === 1) {
          res.status(200).send({ message: "Notice deleted successfully." });
        } else {
          res.status(404).send({ message: "Notice not found." });
        }
      } catch (error) {
        res.status(500).send({ error: "Error deleting notice." });
      }
    });

    // comittee

    app.post("/addComitteeMember", async (req, res) => {
      const data = req.body;
      if (!data) {
        return res.status(400).send({ error: "Payload is missing or invalid" });
      }
      const result = await comitteeCollection.insertOne(data);
      res.send(result);
    });

    app.get("/comittee", async (req, res) => {
      const result = await comitteeCollection.find({}).toArray();
      res.send(result);
    });

    // Event
    app.post("/events", async (req, res) => {
      const { title, images } = req.body;

      if (!title || !images || !Array.isArray(images)) {
        return res
          .status(400)
          .json({ error: "Invalid input. Title and images are required." });
      }

      try {
        const event = { title, images, createdAt: new Date() };
        const result = await eventCollection.insertOne(event);
        res.status(201).json({
          message: "Event created successfully",
          eventId: result.insertedId,
        });
      } catch (error) {
        console.error("Error creating event:", error);
        res.status(500).json({ error: "Error creating event" });
      }
    });

    // GET route to fetch events
    app.get("/allEvents", async (req, res) => {
      try {
        const events = await eventCollection.find().toArray();
        res.status(200).json(events);
      } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ error: "Error fetching events" });
      }
    });

    // vlog
    app.post("/videos", async (req, res) => {
      try {
        const { title, url } = req.body;
        const event = { title, url };
        const result = await vlogCollection.insertOne(event);
        res.status(201).json({
          message: "Vlog created successfully",
          eventId: result.insertedId,
        });
      } catch (error) {
        console.error("Error creating event:", error);
        res.status(500).json({ error: "Error creating Vlog" });
      }
    });

    // Endpoint to get all videos
    app.get("/allVideos", async (req, res) => {
      try {
        const events = await vlogCollection.find().toArray();
        res.status(200).json(events);
      } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).json({ error: "Error fetching events" });
      }
    });

    // login

    app.post("/login", (req, res) => {
      const { username, password } = req.body;

      // Find the user with the given username
      const user = loginCollection.find(
        (user) => user.username === username && user.password === password
      );

      if (user) {
        res.json({ success: true, username: user.username, role: username }); // or "superadmin"
      } else {
        res
          .status(401)
          .json({ success: false, message: "Invalid username or password" });
      }
    });
  } finally {
    // Optionally close the MongoDB connection here when done
  }
}

run().catch(console.log);

app.get("/", async (req, res) => {
  res.send("Mosque server is running");
});

app.listen(port, () => console.log(`Mosque server is running on port ${port}`));
