import express from 'express'
const app = express();             // express is used
app.use(express.json())

import cors from 'cors'
app.use(cors({                          // CORS is used
    origin : process.env.CORS_ORIGIN,
    credentials : true
}))

import cookieParser from 'cookie-parser';  //set and access user cookies, performs CRUD operations
app.use(cookieParser())    
app.use(express.urlencoded({extended:true,limit:'16kb'})) // when url changes the key id then this can get 
app.use(express.static("public")) // this is use to access public folder to get imgs, folder

// import route
import userRouter from '../src/routes/user.routes.js'

app.use("/api/v1/users", userRouter)





export {app}