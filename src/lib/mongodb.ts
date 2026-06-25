import mongoose from 'mongoose';

// FALLBACK langsung ke Atlas URI Anda agar otomatis jalan di Vercel tanpa perlu setting tambahan.
// PERINGATAN: Karena kode ini di-push ke GitHub, pastikan repository GitHub Anda disetel ke PRIVATE
// agar password database Anda tidak dilihat oleh orang lain.
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://ahmadsamsudin27_db_user:ahmadsamsudin27_db_user@cluster0.pe488oz.mongodb.net/pch-cup?appName=Cluster0";

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;
