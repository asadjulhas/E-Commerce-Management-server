const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
var jwt = require("jsonwebtoken");

const port = process.env.PORT || 4000;


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

// Payment function

app.post("/create-payment-intent", VerifyUser, async (req, res) => {
  const service  = req.body;
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


})

    // Create JWT
    app.post("/login", async (req, res) => {
      const user = req.body;
      const accessToken = jwt.sign(user, process.env.JWT, {
        expiresIn: "1d",
      });
      res.send({ accessToken });
    });

        // Add/update user
        app.put('/user/:email', async (req, res) => {
          const email = req.params.email;
          const user = req.body;
          const query = {email: email};
          const options = { upsert: true };
          const updateDoc = {
            $set: user
          };
          const result = userCollections.updateOne(query, updateDoc, options);
         const accessToken = jwt.sign({ email }, process.env.JWT, {
           expiresIn: '1d'
         });
          res.send({accessToken})
    
        })


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
      app.get('/order/:id', VerifyUser, async (req, res) => {
        const id = req.params.id;
        const query = {_id: ObjectId(id)}
        const result = await orderCollections.findOne(query);
        res.send(result)
      })

      // Update payment status for booking
app.put('/payment/:id', VerifyUser, async (req, res) => {
  const id = req.params.id;
  const paymentIntent = req.body;
  const query = {_id: ObjectId(id)};
  const updateDoc = {
    $set: {payment: true, transactionId: paymentIntent.paymentIntent.id}
  };
  const result = await orderCollections.updateOne(query, updateDoc);
  const setPayment = await paymentCollections.insertOne(paymentIntent.paymentIntent);
  res.send({result})

})





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
