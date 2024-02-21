import mongoose,{Schema} from "mongoose";
import bcrypt from 'bcrypt'     //hash the password (change)=> encripted/decripted
import jwt from "jsonwebtoken";   


const userSchema = new Schema({
    userName : {
        type : String,
        required : true,
        lowercase : true,
        unique : true,
        trim : true,
        index : true
    },
    email : {
        type : String,
        required : true,
        lowercase : true,
        unique : true,
        trim : true,
    },
    fullName : {
        type : String,
        required : true,
        trim : true,
        index : true
    },
    avatar : {
        type : String,     //cloudinary service
        required : true,
    },
    coverImage : {
        type : String,     //cloudinary service
    },
    watchHistory : [{
        type : Schema.Types.ObjectId,
        ref : "Video"
    }],
    password : {
        type : String,
        required : [true, 'Password is required']
    },
    refreshToken : {
        type : String
    }
},{timestamps : true})


userSchema.pre("save",async function(next){                // data send/covert in encrypted from
    if(!this.isModified('password')) return next();        //(modified/change)=>bcrypt.hash
                                                              
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.isPasswordCorrect = async function(password){    // access/get which the password is encripted before
   return await bcrypt.compare(password, this.password)
}

userSchema.methods.generateAccessToken = function(){
    return jwt.sign({
        _id : this._id,                            //   jwt.sign({
        userName : this.userName,                  //      data: 'foobar'
        fullName : this.fullName,                  //    }, 'secret', { expiresIn: '1h' });
        email : this.email                                 
    },
    process.env.ACCESS_TOKEN_SECRET,
    {
        expiresIn : process.env.ACCESS_TOKEN_EXPIRY
    }
    )
}
userSchema.methods.generateRefreshToken = function(){
    return jwt.sign({
        _id : this._id,       
    },
    process.env.REFRESH_TOKEN_SECRET,
    {
        expiresIn : process.env.REFRESH_TOKEN_EXPIRY
    }
    )
}


export const User = mongoose.model('User',userSchema)