import express from "express";
import cors from "cors";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import { jwtVerify, createRemoteJWKSet } from "jose";
const app = express();
app.use(cors());
app.use(express.json());
const port = "5000";
const client = new MongoClient(process.env.MONGO_AUTH_URL);

export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}
const mongoClient = await connectToMongoDB();
const database = mongoClient.db("wanderlast");
const travelCollection = database.collection("travel-package-data");
const allDestinationData = database.collection("distinaction-data");
//! middleware
const auth = async (req, res, next) => {
  const token = req.headers.authorization;
  const jwtToken = token?.split(" ")[1];
  if (!jwtToken) {
    res.status(401).send({ massage: "unauthorize" });
  }
  try {
    const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
    );
    const { payload } = await jwtVerify(jwtToken, JWKS);
    next();
  } catch (error) {
    res.status(401).send({ massage: "server error" });
  }
};

app.get("/destination-data", async (req, res) => {
  const data = await allDestinationData.find().toArray();
  res.send(data);
});
app.post("/destination-data", auth, async (req, res) => {
  const data = req.body;
  const result = await allDestinationData.insertOne(data);
  res.send(result);
});
app.get("/destination-data/:id", auth, async (req, res) => {
  const id = req.params.id;
  const data = await allDestinationData
    .find({ _id: new ObjectId(id) })
    .toArray();
  res.send(data);
});

app.post("/update-travel-package", async (req, res) => {
  const { _id, ...data } = req.body;
  const query = { _id: new ObjectId(_id) };
  const result = await allDestinationData.replaceOne(query, data);
  res.send(result);
});

app.get("/add-travel-package/:email", auth, async (req, res) => {
  const email = req.params.email;
  const travelCollectionData = await travelCollection.findOne({ email: email });
  if (!travelCollectionData) {
    res.send({ notFound: true });
  }
  res.send(travelCollectionData);
});

// delete destination
app.get("/delete-destination/:id", async (req, res) => {
  const filter = { _id: new ObjectId(req.params.id) };
  const result = await allDestinationData.deleteOne(filter);
  res.send(result);
});

// add user booking data to 'travelCollection' based on user email

app.post("/add_user_booking_data", auth, async (req, res) => {
  const data = req.body;
  const { email, ...other } = data;
  try {
    await travelCollection.updateOne(
      { email: email },
      { $setOnInsert: { email: email, bookedData: [] } },
      { upsert: true },
    );

    const result = await travelCollection.updateOne(
      {
        email: email,
        "bookedData.id": { $ne: other.id }, // Scans the array elements for matching 'id'
      },
      {
        $push: {
          bookedData: other, // Safely pushed only if the condition above is satisfied
        },
      },
    );

    // 3. Return a helpful response to your frontend application
    if (result.modifiedCount === 0) {
      return res.status(409).json({
        success: false,
        message: "This item has already been booked by this user!",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking added successfully!",
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// delete user booking data base on user email and destination id

app.post("/request_delete_booking", auth, async (req, res) => {
  const data = req.body;
  const result = await travelCollection.updateOne(
    { email: data.email },
    {
      $pull: {
        bookedData: { id: data.id },
      },
    },
  );
  res.send(result);
});

// featured section api
app.get("/feature_destination_data", async (req, res) => {
  const data = await allDestinationData.find({}).limit(5).toArray();
  res.send(data);
});

app.listen(port, () => {
  console.log("server is running on ", port);
});

export default app