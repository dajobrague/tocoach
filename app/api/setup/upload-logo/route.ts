// Logo upload API for Supabase Storage
import { getTrainerSession } from '@/lib/auth/session';
import { createSupabaseClient } from '@/lib/clients/supabase-api';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    const supabase = createSupabaseClient();
    try {
        // Check authentication
        const session = await getTrainerSession();
        if (!session) {
            return NextResponse.json(
                { error: 'No autorizado' },
                { status: 401 }
            );
        }

        const formData = await request.formData();
        const file = formData.get('logo') as File;

        if (!file) {
            return NextResponse.json(
                { error: 'No se encontró el archivo' },
                { status: 400 }
            );
        }

        // Validate file type
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Tipo de archivo no válido. Usa PNG, JPG, SVG o WebP' },
                { status: 400 }
            );
        }

        // Validate file size (2MB)
        if (file.size > 2 * 1024 * 1024) {
            return NextResponse.json(
                { error: 'El archivo es demasiado grande. Máximo 2MB' },
                { status: 400 }
            );
        }

        // Generate file path: trainer-logos/{trainer_id}/logo.{extension}
        const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'png';
        const fileName = `${session.trainer_id}/logo.${fileExtension}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('trainer-logos')
            .upload(fileName, file, {
                upsert: true, // Replace existing file
                contentType: file.type,
            });

        if (uploadError) {
            console.error('[Logo Upload] Storage error:', uploadError);
            return NextResponse.json(
                { error: 'Error al subir el archivo' },
                { status: 500 }
            );
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('trainer-logos')
            .getPublicUrl(fileName);

        const logoUrl = urlData.publicUrl;

        // Update tenant record with logo URL
        const { error: updateError } = await supabase
            .from('tenants')
            .update({ logo_url: logoUrl })
            .eq('trainer_id', session.trainer_id);

        if (updateError) {
            console.error('[Logo Upload] Database update error:', updateError);
            // Don't fail the upload if database update fails
            console.warn('[Logo Upload] Logo uploaded but database update failed');
        }

        console.log(`[Logo Upload] Successfully uploaded logo for trainer ${session.trainer_id}: ${logoUrl}`);

        return NextResponse.json({
            success: true,
            logoUrl,
            message: 'Logo subido correctamente'
        });

    } catch (error) {
        console.error('[Logo Upload] Unexpected error:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
