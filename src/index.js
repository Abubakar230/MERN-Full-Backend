import connectDB from './db/index.js';  // is used for connect database fn
import { app } from './app.js';

import dotenv from 'dotenv'
dotenv.config({path:"./.env"})


const port = process.env.PORT || 5678;



connectDB()    // DB function is used
.then(()=>{
    app.listen(port, ()=>{
        console.log(`this port is running in ${port}`)
    })
})
.catch((err)=>{
    console.log(`This port is not working yet mongodb connection is also failed :`,err)
})


