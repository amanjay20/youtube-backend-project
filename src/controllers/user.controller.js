import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from '../utils/apiError.js'
import { User } from '../models/user.model.js'
import {uploadOnCloudinary , deleteFromCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from "../utils/apiResponse.js";
import jwt from "jsonwebtoken"


const registerUser = asyncHandler( async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res


    const {fullName, email, username, password } = req.body
    //console.log("email: ", email);

    if (
        [fullName, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists")
    }
    //console.log(req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path;

    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }
    

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    console.log(avatar)
    console.log(coverImage)

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required")
    }
   

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        avatarPublicId: avatar.public_id,
        coverImage: coverImage?.url || "",
        coverImagePublicId: coverImage?.public_id || "",
        email, 
        password,
        username: username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

} )

const generateAccessTokenAndRefreshtoken = async(userId) =>{
    try {
        const user  = await User.findById(userId)
        console.log(user)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave:false})
        console.log(user)
        return {accessToken, refreshToken   }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}

const loginUser = asyncHandler(async(req,res)=>{
    const { email, username , password } = req.body

    // if both true then it print(ERROR) and in this case neither email nor useranme given 
    // if any one is given that means !1 means = 0(false) loop not print anything
    if ( !email && !username ) {
        throw new ApiError(400,"Email or username is required")
    }

    const user = await User.findOne({
        $or:[{username} , {email}]
    })

    if (!user) {
        throw new ApiError(404,"User Does not exits")
    }

    const isPasswordValid = await user.isPasswordCorrect(password)
    if (!isPasswordValid){
        throw new ApiError(401, "Invalid User Credentails")
    }

    const {accessToken,refreshToken} = await generateAccessTokenAndRefreshtoken(user._id)

    const loggedUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly : true,
        secure : true
    }

    return res
    .status(200)
    .cookie("accessToken" , accessToken , options)
    .cookie("refreshToken" ,refreshToken, options)
    .json(
        new ApiResponse(
            200,{
                user:loggedUser,accessToken,refreshToken
            },
            "User Logged In SuccessFully"
        )
    )


})

const logoutUser = asyncHandler( async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1 // this removes the field from document
            }
        },
        {
            new: true
        }
    )
    const options = {
        httpOnly: true,
        secure: true
    }
    return res 
    .status(200)
    .clearCookie("accessToken" , options)
    .clearCookie("refreshToken" , options)
    .json( new ApiResponse(200 , {} , "User Logged out"))
})

const refreshAccessToken = asyncHandler( async(req,res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request")
    }
    try {
        const decodedToken = jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET)
        const user = await User.findById(decodedToken?._id)
        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token")

        }
        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401,"Refresh Token is expired or used")
        }

        const options = {
            httpOnly:true,
            secure:true
        }

        const {accessToken , newRefreshToken } = await generateAccessTokenAndRefreshtoken(user._id)

        return res
        .status(200)
        .cookie("accessToken" , accessToken , options)
        .cookie("refreshToken" , newRefreshToken , options)
        .json( 
            new ApiResponse(
                200,
                {accessToken , refreshToken:newRefreshToken},
                "Access Token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid Refresh Token ")
    }
})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body

    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = user.isPasswordCorrect(oldPassword)
    if (!isPasswordCorrect) {
        throw new ApiError(400,"Invalid Old password")
    }
    user.password = newPassword
    await user.save({validateBeforeSave:false})
    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password Changed SuccessFully"))
})

const getCurrentUser = asyncHandler(async(req,res)=>{

    return res
    .status(200)
    .json(new ApiResponse(
        200,
        req.user,
        "User Fetched SuccessFully"
    ))
})

const updateAccountDetails = asyncHandler(async(req,res)=>{
    const { fullName , email} = req.body
    if (! fullName || ! email){
        throw new ApiError(400,"All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName:fullName,
                email: email
            }
        },
        {new:true}
    ).select("-password")
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"))
})


const updateUserAvatar = asyncHandler( async(req,res)=>{

    const oldUser = await User.findById(req.user?._id)
    const avatarLocalPath = req.file?.path
    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar File is missing")
    }    
    // TODO - delete old image cloudinary

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if (!avatar.url) {
        throw new ApiError(400,"Error while uploading  on avatar")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url,
                avatarPublicId:avatar.public_id
            }
        },
        {new:true}
    ).select("-password")

    if (oldUser?.avatarPublicId) {
        await deleteFromCloudinary(oldUser?.avatarPublicId)
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Avatar image updated successfully")
    )
})

const updateUserCoverImage = asyncHandler( async(req,res)=>{
    const oldUser = await User.findById(req.user?._id)
    const coverImageLocalPath = req.file?.path
    if (!coverImageLocalPath) {
        throw new ApiError(400,"Cover Image File is missing")
    }    

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if ( !coverImage.url) {
        throw new ApiError(400,"Error while uploading  on cover Image")
    }

    const user= await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url,
                coverImagePublicId: coverImage.public_id
            }
        },
        {new:true}
    ).select("-password")

     if (oldUser?.coverImagePublicId) {
        await deleteFromCloudinary(oldUser?.coverImagePublicId)
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Cover image updated successfully")
    )
})

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username}  = req.params

    if (!username?.trim()) {
        throw new ApiError(400,"Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match:{
                username : username?.toLowerCase()
            }
        },
        {
            $lookup:{
                from:"subscription",
                localField:"_id",
                foreignField:"channel",
                as:"subscribers" 
            }
        },
        {
            $lookup:{
                from:"subscription",
                localField:"_id",
                foreignField:"subscriber",
                as:"subscribedTo"
            }
        },
        {
            $addFields:{
                subscribersCount:{
                    $size:"subscribers"
                },
                channelsSubscribedToCount:{
                    $size:"subscribedTo"
                },
                isSubscribed:{
                    $cond:{
                        if:{$in:[req.user._id,"$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project:{
                fullName : 1,
                username : 1,
                subscribersCount : 1,
                channelsSubscribedToCount : 1,
                isSubscribed : 1,
                avatar : 1,
                coverImage : 1 , 
                email : 1
            }
        }

    ])
    if (!channel?.length ) {
        throw new ApiError(404 , "Channel does not exits")
    }
    return res
    .status(200)
    .json(
        new ApiResponse(200 , channel[0] , "User Channel fetched successfully ")
    )
})

const getWatchHistory = asyncHandler(async(req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields:{
                            owner:{
                                $first: "$owner"
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
    loginUser,
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