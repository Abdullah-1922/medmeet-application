import { StatusCodes } from 'http-status-codes';
import { JwtPayload, Secret } from 'jsonwebtoken';
import { TDoctor } from './doctor.interface';
import { Doctor } from './doctor.model';
import unlinkFile from '../../../shared/unlinkFile';
import AppError from '../../errors/AppError';
import { jwtHelper } from '../../../helpers/jwtHelper';
import config from '../../../config';
import { QueryBuilder } from '../../builder/QueryBuilder';
import { Appointment } from '../appointment/appointment.model';

const createDoctorToDB = async (payload: Partial<TDoctor>) => {
  // Validate required fields
  const isExist = await Doctor.findOne({
    $or: [{ email: payload.email }, { doctorId: payload.doctorId }],
  });
  if (isExist) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Doctor already exist');
  }
  // Create doctor first
  const doctor = await Doctor.create(payload);

  return doctor;
};

const loginDoctor = async (
  payload: Partial<TDoctor> & { uniqueId: string }
) => {
  const { uniqueId, password } = payload;
  const doctor = await Doctor.findOne({
    $or: [{ email: uniqueId }, { doctorId: uniqueId }],
  }).select('+password');
  if (!doctor) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Doctor not found');
  }

  const isMatch = await Doctor.isMatchPassword(password!, doctor.password);
  if (!isMatch) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid credentials');
  }
  const accessToken = jwtHelper.createToken(
    {
      id: doctor._id,
      role: doctor.role,
      email: doctor.email,
      approvedStatus: doctor.approvedStatus,
    },
    config.jwt.jwt_secret as Secret,
    '90d'
  );
  //create token
  const refreshToken = jwtHelper.createToken(
    { id: doctor._id, role: doctor.role, email: doctor.email },
    config.jwt.jwt_refresh_secret as Secret,
    '150d'
  );

  const { password: _, ...userWithoutPassword } = doctor.toObject();

  return { accessToken, refreshToken, user: userWithoutPassword };
};
const getDoctorProfileFromDB = async (
  doctor: JwtPayload
): Promise<Partial<TDoctor>> => {
  const { id } = doctor;
  const isExistDoctor = await Doctor.findById(id).populate('specialist');
  if (!isExistDoctor) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Doctor doesn't exist!");
  }
  return isExistDoctor;
};

const updateDoctorProfileToDB = async (
  doctorId: JwtPayload,
  payload: Partial<TDoctor>
): Promise<Partial<TDoctor | null>> => {
  const { id } = doctorId;

  const isExistDoctor = await Doctor.isExistDoctorById(id);
  if (!isExistDoctor) {
    throw new AppError(StatusCodes.BAD_REQUEST, "Doctor doesn't exist!");
  }
  if (
    payload.image &&
    isExistDoctor.image &&
    !isExistDoctor.image.includes('default_profile.jpg') &&
    !payload.image.includes(isExistDoctor.image)
  ) {
    unlinkFile(isExistDoctor.image);
  }

  if (payload.professionalIdFront && isExistDoctor.professionalIdFront) {
    unlinkFile(isExistDoctor.professionalIdFront);
  }

  if (payload.professionalIdBack && isExistDoctor.professionalIdBack) {
    unlinkFile(isExistDoctor.professionalIdBack);
  }

  if (payload.medicalLicense && isExistDoctor.medicalLicense) {
    unlinkFile(isExistDoctor.medicalLicense);
  }
  if (payload.dob) {
    const [day, month, year] = payload.dob
      .toISOString()
      .split('T')[0]
      .split('-');
    payload.dob = new Date(`${year}-${month}-${day}`);
  }
  const updateDoc = await Doctor.findOneAndUpdate({ _id: id }, payload, {
    new: true,
    upsert: true,
  });
  if (
    !updateDoc.isAllFieldsFilled &&
    updateDoc &&
    !!(
      updateDoc.specialist &&
      updateDoc.experience &&
      updateDoc.clinic &&
      updateDoc.clinicAddress &&
      updateDoc.consultationFee &&
      updateDoc.aboutDoctor &&
      updateDoc.professionalIdFront &&
      updateDoc.professionalIdBack &&
      updateDoc.medicalLicense
    )
  ) {
    return await Doctor.findOneAndUpdate(
      { _id: id },
      { isAllFieldsFilled: true },
      { new: true }
    );
  }

  return updateDoc;
};
const getSingleDoctor = async (id: string) => {
  const doctor = await Doctor.findById(id).populate('specialist').lean();

  const reviews = await Appointment.find({ doctor: id })
    .populate({
      path: 'user',
      select: 'name country image',
    })
    .select('review')
    .lean();

  

  const result = {
    ...doctor,
    reviews: reviews.map((review: any) => ({
      rating: review.review.rating,
      review: review.review.review,
      createdAt: review.review.createdAt,
      _id: review._id,
      name: review.user.name,
      country: review.user.country,
      image: review.user.image,
    })),
  };
  console.log(result);

  return result;
};
//get all doctors
const getAllDoctors = async (query: any) => {
  const doctorQuery = new QueryBuilder(
    Doctor.find().populate('specialist'),
    query
  )
    .search(['name', 'country', 'clinic'])
    .filter()
    .sort()
    .paginate()
    .fields();
  const result = await doctorQuery.modelQuery;
  const meta = await doctorQuery.countTotal();
  return { result, meta };
};
const updateDoctorApprovedStatus = async (
  id: string,
  payload: { status: string }
) => {
  const doctor = await Doctor.findById(id);
  const status = ['pending', 'approved', 'rejected'];
  if (!status.includes(payload.status)) {
    throw new AppError(StatusCodes.BAD_REQUEST, 'Invalid status');
  }
  if (!doctor) {
    throw new AppError(StatusCodes.NOT_FOUND, 'Doctor not found!');
  }
  const updatedDoctor = await Doctor.findByIdAndUpdate(
    id,
    { approvedStatus: payload.status },
    { new: true }
  );
  return updatedDoctor;
};
const deleteDoctor = async (id: string) => {
  const result = await Doctor.findByIdAndUpdate(
    id,
    { status: 'delete' },
    { new: true }
  );
  return result;
};
export const DoctorService = {
  getDoctorProfileFromDB,
  updateDoctorProfileToDB,
  getSingleDoctor,
  createDoctorToDB,
  getAllDoctors,
  loginDoctor,
  updateDoctorApprovedStatus,
  deleteDoctor,
};
