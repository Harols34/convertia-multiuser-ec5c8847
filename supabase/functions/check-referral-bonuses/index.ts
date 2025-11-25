import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting referral bonus check...');

    // Get configuration
    const { data: config } = await supabase
      .from('referral_config')
      .select('*');

    const configObj: Record<string, string> = {};
    config?.forEach(item => {
      configObj[item.config_key] = item.config_value;
    });

    const minimumDays = parseInt(configObj.minimum_days || '60');
    const bonusAmount = parseFloat(configObj.bonus_amount || '500000');
    const autoAlarmEnabled = configObj.auto_alarm_enabled === 'true';

    console.log(`Configuration: ${minimumDays} days, $${bonusAmount}, auto-alarm: ${autoAlarmEnabled}`);

    // Get all active referrals without bonuses or with pending bonuses
    const { data: referrals } = await supabase
      .from('referrals')
      .select('*, referral_bonuses(*)')
      .eq('status', 'activo');

    console.log(`Found ${referrals?.length || 0} active referrals`);

    let bonusesCreated = 0;
    let alarmsCreated = 0;

    for (const referral of referrals || []) {
      const hireDate = new Date(referral.hire_date);
      const today = new Date();
      const daysSinceHire = Math.floor((today.getTime() - hireDate.getTime()) / (1000 * 60 * 60 * 24));

      // Check if referral has met the minimum days requirement
      if (daysSinceHire >= minimumDays) {
        // Check if bonus record already exists
        const existingBonus = referral.referral_bonuses?.[0];

        if (!existingBonus) {
          // Create bonus record
          const { data: newBonus, error: bonusError } = await supabase
            .from('referral_bonuses')
            .insert({
              referral_id: referral.id,
              bonus_amount: bonusAmount,
              condition_met_date: today.toISOString().split('T')[0],
              status: 'pendiente'
            })
            .select()
            .single();

          if (bonusError) {
            console.error('Error creating bonus:', bonusError);
            continue;
          }

          bonusesCreated++;
          console.log(`Created bonus for referral ${referral.referred_name}`);

          // Create alarm if auto-alarm is enabled
          if (autoAlarmEnabled && newBonus) {
            const { error: alarmError } = await supabase
              .from('alarms')
              .insert({
                end_user_id: referral.referring_user_id,
                title: `Bono de Referido Listo para Pago - ${referral.referred_name}`,
                description: `El referido ${referral.referred_name} (${referral.referred_document}) ha cumplido ${daysSinceHire} días desde su contratación. El bono de $${bonusAmount.toLocaleString('es-CO')} está listo para ser pagado.`,
                status: 'abierta',
                priority: 'alta'
              });

            if (!alarmError) {
              alarmsCreated++;
              console.log(`Created alarm for referral ${referral.referred_name}`);
              
              // Mark alarm as generated in bonus record
              await supabase
                .from('referral_bonuses')
                .update({ alarm_generated: true })
                .eq('id', newBonus.id);
            }
          }
        } else if (existingBonus.status === 'pendiente' && !existingBonus.alarm_generated && autoAlarmEnabled) {
          // Create alarm for existing pending bonus without alarm
          const { error: alarmError } = await supabase
            .from('alarms')
            .insert({
              end_user_id: referral.referring_user_id,
              title: `Bono de Referido Listo para Pago - ${referral.referred_name}`,
              description: `El referido ${referral.referred_name} (${referral.referred_document}) ha cumplido ${daysSinceHire} días desde su contratación. El bono de $${existingBonus.bonus_amount.toLocaleString('es-CO')} está listo para ser pagado.`,
              status: 'abierta',
              priority: 'alta'
            });

          if (!alarmError) {
            alarmsCreated++;
            console.log(`Created alarm for existing bonus: ${referral.referred_name}`);
            
            await supabase
              .from('referral_bonuses')
              .update({ alarm_generated: true })
              .eq('id', existingBonus.id);
          }
        }
      }
    }

    console.log(`Process completed: ${bonusesCreated} bonuses created, ${alarmsCreated} alarms created`);

    return new Response(
      JSON.stringify({
        success: true,
        bonusesCreated,
        alarmsCreated,
        message: `Processed ${referrals?.length || 0} referrals`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-referral-bonuses:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
