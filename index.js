const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
var jwt = require('jsonwebtoken');


const port = process.env.PORT || 5000;

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');


// Middleware
app.use(cors());
app.use(express.json())

// Verify user token
function VerifyUser (req, res, next)  {
  const accessToken = req.headers.authorization;
  if(!accessToken){
    return res.status(401).send({Message: 'unauthorized access'})
  }
  const token = accessToken.split(' ')[1];
  jwt.verify(token, process.env.JWT, function(err, decoded) {
    if(err) {
      return res.status(403).send({Message: 'unauthorized access'})
    }
    req.decoded = decoded;
    next();
  });
}



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.mo3lp.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run() {
  try {
    await client.connect();

    const productsCollections = client.db('borak').collection('products')
    const orderCollections = client.db('borak').collection('orders')

    // Create JWT
app.post('/login', async (req, res) => {
  const user = req.body;
  const accessToken = jwt.sign(user, process.env.JWT, {
    expiresIn: '1d'
  })
  res.send({accessToken})
})

    // Get all products
    app.get('/product', async (req, res) => {
      const products = await productsCollections.find().toArray();
      res.send(products)
    })

    // Get single products
    app.get('/product/:id', VerifyUser, async (req, res) => {
      const id = req.params.id;
      const query = {_id: ObjectId(id)}
      const tool = await productsCollections.findOne(query);
      res.send(tool)
    })

    // Store order
    app.post('/order', async (req, res) => {
      const data = req.body;
      const result = await orderCollections.insertOne(data);
      res.send(result)
    })

       // My orders
       app.get('/my-orders', VerifyUser, async (req, res) => {
        const email = req.query.email;
        const tokenEmail = req.decoded.email;
        if(tokenEmail === email) {
        const query = {email: email}
        const appointment = await orderCollections.find(query).toArray();
        res.send(appointment)
      } else {
        return res.status(403).send({Message: 'Forbidden'})
      }
      }) 

  }
  finally {
    // await client.close()
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello Borak')
})

app.listen(port, () => {
  console.log('Opening Borak server on port', port)
})