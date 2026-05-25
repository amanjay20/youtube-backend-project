import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from '../utils/apiError.js'
import { User } from '../models/user.model.js'
import {uploadOnCloudinary} from '../utils/cloudinary.js'
import { ApiResponse } from "../utils/apiResponse.js";

const registerUser = asyncHandler ( async(req,res)=>{
    // get user details from frontend 
    // validation - not empty
    // check if user already exits: username , email
    // check form images , check for avatar
    // upload them on cloudinary , avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return response
    const { username , email , fullName , password } =  req.body
    // console.log(req.body)

    if (
        [username , email , fullName , password].some( (field)=> field?.trim()==="")
    ) {
        throw new ApiError(400,"All Fields are required")
    }

    const existedUser = await User.findOne({
        $or:[{username},{email}]
    })
    if (existedUser) {
        throw new ApiError(409,"User with email or username already exists")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path
    // console.log(req.files)
    // const coverImageLocalPath = req.files?.coverImage[0].path
    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarLocalPath) {
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if (!avatar) {
        throw new ApiError(400,"Avatar File is required")
    }

    const user = await User.create({
        fullName,
        avatar : avatar.url,
        coverImage : coverImage.url,
        email,
        password,
        username:username.toLowerCase()
    })

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    if (!createdUser) {
        throw new ApiError(500,"Something went wrong while registering the user ")
    }
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User registered SuccessFully")
    )
})

const generateAccessTokenAndRefreshtoken = async(userId) =>{
    try {
        const user  = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave:False})
        return {accessToken, refreshToken   }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating access and refresh token")
    }
}

const loginUser = asyncHandler(async(req,res)=>{
    const { email, username , password } = req.body

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





export {registerUser}