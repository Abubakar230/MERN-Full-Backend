import asyncHandler from '../utils/asyncHandler.js'
import {ApiError} from '../utils/ApiError.js'
import {User} from '../models/user.model.js'
import {uploadcloudinary} from '../utils/cloudinary.js'
import {ApiResponse} from '../utils/ApiResponse.js'
import jwt from "jsonwebtoken"
import mongoose from 'mongoose'


const generateAccessAndRefreshToken = async(userId)=>{
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave : false})
        
        return {accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500, "Something went wrong while genereting access and refresh token")
    }
}

const registerUser = asyncHandler( async (req,res)=>{
    // Get user details from frontend
    // Validation - not empty
    // Check if user is already exists : username, email
    // Check for images, Check for avatar
    // Upload them to cloudinary, avatar
    // Create user object - create entry in db
    // Remove password and refresh token field from response
    // Check for user creation
    // Return res


    const {userName,email,fullName,password} = req.body
    // console.log('userName:',userName);


    if ([fullName,userName,email,password].some((field)=>field?.trim()=== "")) {
        throw new ApiError(400, "All fields are required")
    }


    const existedUser = await User.findOne({
        $or : [{userName},{email}]
    })
    if (existedUser) {
        throw new ApiError(409, "User with email or username already exist")
    }

    // console.log(req.files)
    const avatarLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }//if covering not then ""

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }


    const avatar = await uploadcloudinary(avatarLocalPath)
    const coverImage = await uploadcloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }


    const user = await User.create({
        fullName,
        email,
        userName : userName.toLowerCase(),
        password,
        avatar : avatar.url,
        coverImage : coverImage?.url || "" 
    })


    const createdUser = await User.findById(user._id).select("-password -refreshToken")
    if (!createdUser) {
        throw new ApiError(500,"Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully")
    )


})

const userLogin = asyncHandler( async (req,res)=>{
    // req body => data
    // username, email check
    // find the user
    // password check
    // access and refresh token
    // send cookie

    const {userName,email,password} = req.body

    if (!(userName || email)) {
        throw new ApiError(404,"username and email is required")
    }


    const user = await User.findOne({
        $or : [{userName},{email}]
    })
    if (!user) {
        throw new ApiError(404,"this user does not exist")
    }


    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid) {
        throw new ApiError(401,"this password is not valid")
    }


    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    const options = {
        httpOnly : true,
        secure : true
    }


    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{
            user : loggedInUser,accessToken,refreshToken
        },
        "User LoggedIn successfully"
        )
    )



})

const logoutUser = asyncHandler( async (req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset : {
                refreshToken : 1     // this remove the field form document
            }
        },
        {
            new : true
        }
    )

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200, "User logged Out"))
})

const refreshAccessToken = asyncHandler( async (req,res)=>{

    try {
        const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
        if (!incomingRefreshToken) {
            throw new ApiError(401,"Unauthorized request")
        }
    
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
    
        const user = await User.findById(decodedToken?._id)
    
        if (!user) {
            throw new ApiError(401,"Invalid Refresh Token")
        }
        
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401,"Refresh token is expired or used")
        }
    
        const options  = {
            httpOnly : true,
            secure : true
        }
    
        const {accessToken,newRefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(200,
                {accessToken,refreshToken : newRefreshToken},
                "Access token refreshed")
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid Refresh Token")
    }

})

const changeCurrentPassword = asyncHandler( async(req,res)=>{

    const { oldPassword,newPassword } = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave : false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password changed successfully") )

})

const getCurrentUser = asyncHandler( async(req,res)=>{

    return res
    .status(200)
    .json( new ApiResponse(200, req.user , "Current user fetched successfully"))

})

const updateAccountDetails = asyncHandler( async(req,res)=>{

    const {email,fullName} = req.body

    if (!(email || fullName ) ) {
        throw new ApiError(400,'All fields are required')
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set : {
                fullName,
                email
            }
        },
        {
            new : true
        }
        ).select("-password")


    return res
    .status(200)
    .json(new ApiResponse(200,user, "Account detail is updated successfully"))

})

const updateUserAvatar = asyncHandler( async(req,res)=>{

    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing")
    }
    
    const avatar = await uploadcloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set :{
                avatar : avatar.url
            }
        },
        {new : true}
    ).select("-password")


    return res
    .status(200)
    .json(new ApiResponse(200,user,"Avatar updated successfully"))

})

const updateUserCoverImage = asyncHandler( async(req,res)=>{

    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "coverImage file is missing")
    }
    
    const coverImage = await uploadcloudinary(coverImageLocalPath)
    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading on coverImage")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set :{
                coverImage : coverImage.url
            }
        },
        {new : true}
    ).select("-password")


    return res
    .status(200)
    .json(new ApiResponse(200,user,"coverImage updated successfully"))

})

const getUserChannelProfile = asyncHandler( async(req,res)=>{
// subscription model used
    const {userName} = req.params

    if (!userName?.trim()) {
        throw new ApiError(400, "UserName is missing")
    }

    const channel = await User.aggregate([
        {
            $match : {
                userName : userName?.toLowerCase()
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : "_id",
                foreignField : "channel",  // to get all subscriber in my channel
                as : "subscribers"
            }
        },
        {
            $lookup : {
                from : "subscriptions",
                localField : "_id",
                foreignField : "subscriber",  // to get how many channels you subscribed
                as : "subscribedTo"
            }
        },
        {
            $addFields : {
                subscriberCount : {             // to count how many subscriber you have
                    $size : "subscribers"
                },
                channelsSubscribedToCount : {   //to count how many channels you subscribed
                    $size : "subscribedTo"
                },
                isSubscribed : {
                    $cond : {
                        if : { $in : [req.user?._id, "$subscribers.subscriber" ] },
                        then : true,
                        else : false
                    }
                }
            }
        },
        {
            $project : {              // to give this user detail to the chnnel owner
                fullName : 1,
                userName : 1,
                subscriberCount : 1,
                channelsSubscribedToCount : 1,
                isSubscribed : 1,
                avatar : 1,
                coverImage : 1,
                email : 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(400, "Channel does not exist")
    }


    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )

})

const getWatchHistory = asyncHandler( async(req,res)=>{

    const user = await User.aggregate([

        {                 //method to match user
            $match : {
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup : {
                from : "videos",
                localField : "watchHistory",           // users who watch your channels
                foreignField : "_id",
                as : "watchHistory",
                pipeline : [
                    {
                        $lookup : {
                            from : "users",
                            localField : "owner",        // the owner of channel
                            foreignField : "_id",
                            as : "owner",
                            pipeline : [
                                {
                                    $project : {          // used to get this data(owner)
                                        fullName : 1,
                                        userName : 1,
                                        avatar : 1,
                                    }
                                }
                            ]
                        }    
                    },
                    {
                        $addFields : {          // get data in objects (easier to frontEnd)
                            owner : {
                                $first : "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])


    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            user[0].watchHistory,
            "Watch history fetched successfully"
        )
    )


})



export {
    registerUser,
    userLogin,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}