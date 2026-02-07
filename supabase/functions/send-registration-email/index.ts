// deno-lint-ignore-file no-explicit-any
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Payload = {
  email: string;
  fullName: string;
  registrationNo: string;
  rollNo: string;
};

const smtpHost = Deno.env.get('SMTP_HOST') ?? '';
const smtpPort = Number(Deno.env.get('SMTP_PORT') ?? '465');
const smtpUser = Deno.env.get('SMTP_USER') ?? '';
const smtpPass = Deno.env.get('SMTP_PASS') ?? '';
const fromEmail = Deno.env.get('FROM_EMAIL') ?? '';
const fromName = Deno.env.get('FROM_NAME') ?? 'Social Equality Federation';

const { default: nodemailer } = await import('npm:nodemailer@6.9.10');

const transport = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpPort === 465,
  auth: {
    user: smtpUser,
    pass: smtpPass,
  },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;
    const { email, fullName, registrationNo, rollNo } = payload;

    if (!email || !registrationNo || !rollNo) {
      return new Response(JSON.stringify({ error: 'Missing email or registration details.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!smtpHost || !smtpUser || !smtpPass || !fromEmail) {
      return new Response(
        JSON.stringify({
          error: `SMTP not configured. host=${smtpHost || 'missing'} port=${Number.isFinite(smtpPort) ? smtpPort : 'invalid'} user=${smtpUser ? 'set' : 'missing'} from=${fromEmail || 'missing'}`,
        }),
        {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    const message = `Hello ${fullName || 'Student'},\n\nYour registration is successful.\nRegistration No: ${registrationNo}\nRoll No: ${rollNo}\n\nRegards,\nSocial Equality Federation`;

    await transport.sendMail({
      from: `${fromName} <${fromEmail}>`,
      to: email,
      subject: 'Your Registration Details',
      text: message,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error?.message ?? 'Email send failed.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
