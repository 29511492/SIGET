<?php

//Para Enviar el codigo OTP por correo Electronico
namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class OtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public readonly string $otp,
        public readonly string $motivo, // 'recuperacion' | 'desbloqueo'
        public readonly string $nombre,
    ) {}

    public function envelope(): Envelope
    {
        $asunto = $this->motivo === 'desbloqueo'
            ? 'Desbloqueo de cuenta — SIGET'
            : 'Recuperación de contraseña — SIGET';

        return new Envelope(subject: $asunto);
    }

    public function content(): Content
    {
        return new Content(view: 'emails.otp');
    }

    public function attachments(): array
    {
        return [];
    }
}
