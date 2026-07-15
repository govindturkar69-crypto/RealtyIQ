import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    refreshTokens: { type: [String], default: [], select: false },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (password) {
  this.passwordHash = await bcrypt.hash(password, 10);
};
userSchema.methods.verifyPassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};
userSchema.methods.toJSON = function () {
  const o = this.toObject();
  delete o.passwordHash;
  delete o.refreshTokens;
  delete o.__v;
  return o;
};

export const User = mongoose.model("User", userSchema);
