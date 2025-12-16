const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.two3kqb.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("blood-donation-db");
    const usersCollection = db.collection("users");
    const donationRequestsCollection = db.collection("donation-requests");

   app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const existingUser = await usersCollection.findOne({
          email: user.email,
        });

        if (existingUser) {
          return res.send({ message: "user already exists" });
        }

        const newUser = {
          ...user,
          role: "donor",
          status: "active",
        };

        const result = await usersCollection.insertOne(newUser);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Registration failed" });
      }
    });

     app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });
        res.send(user);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch profile" });
      }
    });


    // Update profile
     app.patch("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const updatedData = { ...req.body };
        delete updatedData._id;
        delete updatedData.email;

        const result = await usersCollection.updateOne(
          { email },
          { $set: updatedData }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Profile update failed" });
      }
    });

    // admin 
     app.get("/admin-stats", async (req, res) => {
      try {
        const totalUsers = await usersCollection.countDocuments();
        const totalDonationRequests =
          await donationRequestsCollection.countDocuments();

        res.send({
          totalUsers,
          totalDonationRequests,
          totalFunding: 0,
        });
      } catch (err) {
        res.status(500).send({ message: "Failed to load stats" });
      }
    });


    app.get("/users", async (req, res) => {
      try {
        const { status } = req.query;
        const query = {};
        if (status) query.status = status;

        const users = await usersCollection.find(query).toArray();
        res.send(users);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch users" });
      }
    });


    app.patch("/users/block/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "blocked" } }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to block user" });
      }
    });

     app.patch("/users/unblock/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: "active" } }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to unblock user" });
      }
    });


     app.patch("/users/make-volunteer/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: "volunteer" } }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to make volunteer" });
      }
    });

    app.patch("/users/make-admin/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role: "admin" } }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to make admin" });
      }
    });

    // donation 

     app.post("/donation-requests", async (req, res) => {
      try {
        const request = req.body;
        const requester = await usersCollection.findOne({ email: request.requesterEmail });

        if (!requester || requester.status !== "active") {
          return res.status(403).send({ message: "Blocked users cannot create requests" });
        }

        const newRequest = { ...request, status: "pending", createdAt: new Date() };
        const result = await donationRequestsCollection.insertOne(newRequest);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to create donation request" });
      }
    });

    // Get donation requests
    app.get("/donation-requests", async (req, res) => {
      try {
        const { requesterEmail, status, page = 1, limit = 10 } = req.query;
        const query = {};
        if (requesterEmail) query.requesterEmail = requesterEmail;
        if (status) query.status = status;

        const requests = await donationRequestsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .skip((parseInt(page) - 1) * parseInt(limit))
          .limit(parseInt(limit))
          .toArray();

        const total = await donationRequestsCollection.countDocuments(query);

        res.send({ total, page: parseInt(page), limit: parseInt(limit), requests });
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch donation requests" });
      }
    });

    // Get single donation request
    app.get("/donation-requests/:id", async (req, res) => {
      try {
        const request = await donationRequestsCollection.findOne({ _id: new ObjectId(req.params.id) });
        res.send(request);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch donation request" });
      }
    });

    // Update donation request
    app.patch("/donation-requests/:id", async (req, res) => {
      try {
        const updatedData = req.body;
        delete updatedData._id;

        const result = await donationRequestsCollection.updateOne(
          { _id: new ObjectId(req.params.id) },
          { $set: updatedData }
        );
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to update donation request" });
      }
    });

    // Delete donation request
    app.delete("/donation-requests/:id", async (req, res) => {
      try {
        const result = await donationRequestsCollection.deleteOne({ _id: new ObjectId(req.params.id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to delete donation request" });
      }
    });

    // Admin sees all donation requests
    app.get("/admin/donation-requests", async (req, res) => {
      try {
        const requests = await donationRequestsCollection.find().sort({ createdAt: -1 }).toArray();
        res.send(requests);
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch admin requests" });
      }
    });


    app.get("/", (req, res) => {
      res.send("Blood donation API running");
    });

    console.log("MongoDB connected successfully");
  } finally {
  }
}

run().catch((err) => console.error("MongoDB connection error:", err));

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
