import User from "../models/user.model.js";
import { generateToken } from "../lib/utils.js";
import bcrypt from "bcryptjs";



export const signup = async  (req,res) =>{
   const {fullName,email,password} =  req.body
   try {

    if (!fullName || !email || !password){
        return res.status(400).json({message: "all the fields are required"})

    }

    if(password.length <6){
        return res.status(400).json({message: "Password mus t be at least 6 character"})
    }
    const user = await User.findOne({email})

    if (user) return res.status(400).json({message:"Email already exists"});

    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password,salt)

    const newUser = new User({
        fullName,
        email,
        password:hashedPassword
    })
    

    if(newUser){
        //generate the jwt token here
        generateToken(newUser._id,res)
        await newUser.save();

        res.status(201).json({
            _id:newUser._id,
            fullName: newUser.fullName,
            email: newUser.email,
            profilePic:newUser.profilePic,

        });


    }else{
        res.status(400).json({message:"invalid user data"});
    }
    
    
   } catch (error) {
    console.log("Error in signup controller",error.message);
    res.status(500).json({message:"internal Server Error"});

    
   }
};
export const login =  async (req,res) =>{
   const {email,password} = req.body
   try {
    const user = await User.findOne({email})


    if(!user) {
        return res.status(400).json({message:"invalid credentials"})
    }

    const isPasswordCorrect = await bcrypt.compare(password,user.password)
    if(!isPasswordCorrect){return res.status(400).json({message:"invalid credentials"})}


    generateToken(user._id,res)


    res.status(200).json({
        _id:user._id,
        fullName:user.fullName,
        email:user.email,
        profilePic:user.profilePic,
    })
    
   } catch (error) {
    console.log("error in the login controller",error.message);
    res.status(400).json({message:"logged in succesfully"})
    
   }
};
export const logout = (req,res) =>{
 try {
    res.cookie("jwt","",{maxAge:0})
    return res.status(400).json({message:"logged out succesfully"})

    
 } catch (error) {
    
 }
};


export const updateProfile = async (req,res) => {
    try {
        const {profilePic} = req.body;
        const userId = req.user._id;

        if(!profilePic){
            return res.status(400).json({message:"Profile pic is required"});
        }

        const uploadResponse = await cloudinary.uploader.upload(profilePic);
        const updateUser = await User.findByIdAndUpdate(
            userId,
            { profilePic: uploadResponse.secure_url},
            {new: true}
        );

        res.status(200).json(updateUser);

        
    } catch (error) {
        console.log("errr in update profile:" , error);
        res.status(500).json({message:"internal server error"});
        
    }
    

};

export const checkAuth = async (req,res) => {
    try {
        res.status(200).json(req.user);
    } catch (error) {
        console.log("error in checkAuth controller",error.message);
        res.status(500).json({message: "internal server error"})
        
    }

}