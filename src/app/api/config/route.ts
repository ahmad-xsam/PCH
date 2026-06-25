import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Config from '@/models/Config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await dbConnect();
    const configs = await Config.find({});
    
    // Convert array to a key-value object
    const configMap: { [key: string]: any } = {
      tournamentType: 'single-elimination',
      tournamentName: 'PCH Cup Tournament'
    };
    
    configs.forEach(c => {
      configMap[c.key] = c.value;
    });

    return NextResponse.json({ success: true, data: configMap });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    await dbConnect();
    const body = await request.json(); // expected { key, value }
    const { key, value } = body;
    
    if (!key) {
      return NextResponse.json({ success: false, error: 'Key is required' }, { status: 400 });
    }

    const config = await Config.findOneAndUpdate(
      { key },
      { value },
      { new: true, upsert: true }
    );

    return NextResponse.json({ success: true, data: config });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }
}
