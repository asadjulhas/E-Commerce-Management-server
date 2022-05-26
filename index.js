const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
var jwt = require("jsonwebtoken");

const port = process.env.PORT || 5000;

// For Payment
const stripe = require("stripe")(process.env.STRIPE_SECRATE_KEY);

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// Middleware
app.use(cors());
app.use(express.json());

// Verify user token
function VerifyUser(req, res, next) {
  const accessToken = req.headers.authorization;
  if (!accessToken) {
    return res.status(401).send({ Message: "unauthorized access" });
  }
  const token = accessToken.split(" ")[1];
  jwt.verify(token, process.env.JWT, function (err, decoded) {
    if (err) {
      return res.status(403).send({ Message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
}

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mo3lp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();

    const productsCollections = client.db("borak").collection("products");
    const orderCollections = client.db("borak").collection("orders");
    const userCollections = client.db("borak").collection("users");
    const paymentCollections = client.db("borak").collection("payments");
    const reviewCollections = client.db("borak").collection("reviews");

    // Verify admin
    const verifyAdmin = async (req, res, next) => {
      const tokenEmail = req.decoded.email;
      const tokenQuery = { email: tokenEmail, role: "admin" };
      const checkAdmin = await userCollections.findOne(tokenQuery);
      if (checkAdmin) {
        next();
      } else {
        res.send({ message: "You dont have admin access bro" });
      }
    };

    // Payment function

    app.post("/create-payment-intent", VerifyUser, async (req, res) => {
      const service = req.body;
      const price = service.amount;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        automatic_payment_methods: {
          enabled: true,
        },
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Create JWT
    app.post("/login", async (req, res) => {
      const user = req.body;
      const accessToken = jwt.sign(user, process.env.JWT, {
        expiresIn: "1d",
      });
      res.send({ accessToken });
    });

    // Add/update user
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollections.updateOne(query, updateDoc, options);
      const accessToken = jwt.sign({ email }, process.env.JWT, {
        expiresIn: "1d",
      });
      res.send({ accessToken });
    });

    // Get all products
    app.get("/product", async (req, res) => {
      const products = await productsCollections.find().toArray();
      res.send(products);
    });

    // Get single products
    app.get("/product/:id", VerifyUser, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const tool = await productsCollections.findOne(query);
      res.send(tool);
    });

    // Store order
    app.post("/order", async (req, res) => {
      const data = req.body;
      const result = await orderCollections.insertOne(data);
      res.send(result);
    });

    // My orders
    app.get("/my-orders", VerifyUser, async (req, res) => {
      const email = req.query.email;
      const tokenEmail = req.decoded.email;
      if (tokenEmail === email) {
        const query = { email: email };
        const appointment = await orderCollections.find(query).toArray();
        res.send(appointment);
      } else {
        return res.status(403).send({ Message: "Forbidden" });
      }
    });

    // Delete order
    app.delete("/order/:id", VerifyUser, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollections.deleteOne(query);
      res.send(result);
    });

    // Find a order
    app.get("/order/:id", VerifyUser, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollections.findOne(query);
      res.send(result);
    });

    // Update payment status for booking
    app.put("/payment/:id", VerifyUser, async (req, res) => {
      const id = req.params.id;
      const paymentIntent = req.body;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: { payment: true, transactionId: paymentIntent.paymentIntent.id },
      };
      const result = await orderCollections.updateOne(query, updateDoc);
      const setPayment = await paymentCollections.insertOne(
        paymentIntent.paymentIntent
      );
      res.send({ result });
    });

    // Add Review
    app.post("/review", VerifyUser, async (req, res) => {
      const review = req.body;
      const result = await reviewCollections.insertOne(review);
      res.send(result);
    });

    // Gel all Review
    app.get("/reviews", async (req, res) => {
      const result = await reviewCollections.find().toArray();
      res.send(result);
    });

    // Update user profile
    app.post("/update-profile", VerifyUser, async (req, res) => {
      const data = req.body;
      const query = { email: data.email };
      const updateDoc = {
        $set: {
          phone: data.phone,
          address: data.address,
          linkedin: data.linkedin,
        },
      };
      const result = await userCollections.updateOne(query, updateDoc);
      res.send(result);
    });

    // Get a user
    app.get("/user/:email", VerifyUser, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollections.findOne(query);
      res.send(result);
    });

    // Check admin
    app.get("/check-admin/:email", VerifyUser, async (req, res) => {
      const email = req.params.email;
      const Query = { email: email, role: "admin" };
      const checkAdmin = await userCollections.findOne(Query);
      res.send(checkAdmin);
    });

    // Get all user
    app.get("/all-users", VerifyUser, verifyAdmin, async (req, res) => {
      const query = {};
      const allUsers = await userCollections.find(query).toArray();
      res.send(allUsers);
    });

    // Remove Admin
    app.put(
      "/remove-admin/:email",
      VerifyUser,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const query = { email: email };
        const updateDoc = {
          $set: { role: "" },
        };
        const result = await userCollections.updateOne(query, updateDoc);
        res.send({ result });
      }
    );

    // Make Admin
    app.put("/admin/:email", VerifyUser, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollections.updateOne(query, updateDoc);
      res.send({ result });
    });

    // Add Product
    app.post("/product", VerifyUser, verifyAdmin, async (req, res) => {
      const data = req.body;
      const result = await productsCollections.insertOne(data);
      res.send(result);
    });

    // Get all orders
    app.get("/orders", VerifyUser, verifyAdmin, async (req, res) => {
      const query = {};
      const orders = await orderCollections.find(query).toArray();
      res.send(orders);
    });

    // Update status for shipped
    app.put("/status/:id", VerifyUser, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: { status: "shipped" },
      };
      const result = await orderCollections.updateOne(query, updateDoc);
      res.send(result);
    });

    // Delete order
    app.delete("/product/:id", VerifyUser, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await productsCollections.deleteOne(query);
      res.send(result);
    });

    // Make Admin
    app.put("/product", VerifyUser, verifyAdmin, async (req, res) => {
      const data = req.body;
      const id = data.id;
      const query = { _id: ObjectId(id) };
      const updateDoc = {
        $set: {
          name: data.fname,
          description: data.fdescription,
          minOrder: data.fminOrder,
          price: data.fprice,
          stock: data.fstock,
          type: data.ftype,
        },
      };
      // console.log(updateDoc)
      const result = await productsCollections.updateOne(query, updateDoc);
      res.send({result})
    });


    
  } finally {
    // await client.close()
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello Borak");
});

app.listen(port, () => {
  console.log("Opening Borak server on port", port);
});
