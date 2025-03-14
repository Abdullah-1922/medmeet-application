"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserResetToken = void 0;
const mongoose_1 = require("mongoose");
const userResetTokenSchema = new mongoose_1.Schema({
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
    },
    token: {
        type: String,
        required: true,
    },
    expireAt: {
        type: Date,
        required: true,
    },
}, { timestamps: true });
//token check
userResetTokenSchema.statics.isExistToken = (token) => __awaiter(void 0, void 0, void 0, function* () {
    return yield exports.UserResetToken.findOne({ token });
});
//token validity check
userResetTokenSchema.statics.isExpireToken = (token) => __awaiter(void 0, void 0, void 0, function* () {
    const currentDate = new Date();
    const resetToken = yield exports.UserResetToken.findOne({
        token,
        expireAt: { $gt: currentDate },
    });
    return !!resetToken;
});
exports.UserResetToken = (0, mongoose_1.model)('UserResetToken', userResetTokenSchema);
