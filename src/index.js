import { configDotenv } from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";

// Load environment variables from .env
configDotenv();

app.on("error" , (error)=>{
        console.log("ERR:", error)
        
    })

connectDB()
.then( ()=>{


    app.listen(process.env.PORT || 8000 , ()=>{
        console.log(`server is running on PORT: ${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log("DB connection Failed", err)
})