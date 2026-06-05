import mongoose , {schema} from 'mongoose';

const subscriptionSchema = new Schema({
    subscriber:{
        type:Schema.Types.ObjectId, // one who is watching
        ref:"User"
    },
    channel:{
        type:Schema.Types.ObjectId, // one to whom "subscriber" is subscribing
        ref:"User"
    }
},{timestamps:true})

export const Subscription = mongoose.model("Subscription" , subscriptionSchema)