import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        const mongoUrl = process.env.MONGODB_URL || process.env.MONGO_URI;
        
        if (!mongoUrl) {
            throw new Error('MongoDB connection string not found. Please set MONGODB_URL or MONGO_URI environment variable.');
        }
        
        const conn = await mongoose.connect(mongoUrl);
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.log("MongoDB connection error:", error);
        process.exit(1);
    }
};