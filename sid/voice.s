; cozy-tracker SID driver: note start, the per-frame voice update, sound effects and the
; filter. Voices 0-2 play the music; voice 3 is the sound effect, which borrows SID voice 3
; while the music's voice 2 keeps running without writing it (music.html, 2.9).

; A = note, X = voice: start the voice's instrument.
start_note:
        sta v_note,x
        lda #0
        sta v_hold,x
        ldy v_ins,x
        lda ins_ad,y
        sta v_ad,x
        lda p_vol,x             ; the volume column overrides the sustain level
        bmi @sr
        asl
        asl
        asl
        asl
        sta m_a
        lda ins_sr,y
        and #$0f
        ora m_a
        jmp @setsr
@sr:    lda ins_sr,y
@setsr: sta v_sr,x
        lda ins_wave,y
        sta v_wtpos,x
        lda #0
        sta v_slide_lo,x
        sta v_slide_hi,x
        sta v_wtnote,x
        lda #1
        sta v_gate,x
        lda ins_pw_hi,y         ; $ff: keep the pulse running from the last note, limits too
        bmi @filter
        sta v_pw_hi,x
        lda ins_pw_lo,y
        sta v_pw_lo,x
        lda ins_pw_spd,y
        sta v_pw_spd,x
        lda ins_pw_min,y
        sta v_pw_min,x
        lda ins_pw_max,y
        sta v_pw_max,x
@filter:
.if FILTERS
        cpx #3
        bcs @done
        lda ins_flt,y           ; filter program + 1, 0 (none) or $ff (carry)
        beq @nofilt
        stx f_owner             ; carry: this voice takes the filter as it runs
        cmp #$ff
        beq @done
        tay
        lda flt_cut-1,y
        sta f_cut
        lda flt_spd-1,y
        sta f_spd
        lda flt_min-1,y
        sta f_min
        lda flt_max-1,y
        sta f_max
        lda flt_res-1,y
        sta f_res
        lda flt_mode-1,y
        sta f_mode
        rts
@nofilt: cpx f_owner
        bne @done
        lda #$ff
        sta f_owner
.endif
@done:  rts

; X = voice: one frame of wavetable, pitch effects and pulse; then its registers. A voice
; whose pitch cannot change (v_hold: wavetable stopped, no effect) keeps last frame's
; frequency; the row apply and a new note clear v_hold.
voice_frame:
        lda v_hold,x
        beq @wtable
        jmp @pulse
@wtable: ldy v_wtpos,x
        cpy #$ff
        beq @pitch
@wt:    lda wt_wave,y
        cmp #$ff
        bne @step
        lda wt_note,y           ; jump target, or $ff: hold
        tay
        cpy #$ff
        bne @wt
        tya
        sta v_wtpos,x
        jmp @pitch
@step:  sta v_wave,x
        lda wt_note,y
        sta v_wtnote,x
        iny
        tya
        sta v_wtpos,x
@pitch: lda v_wtnote,x
        bpl @rel
        and #$7f                ; absolute note
        jmp @clamp
@rel:   cmp #$40
        bcc @up
        ora #$80
@up:    clc
        adc v_note,x
        sta m_a
        lda v_fx,x
        cmp #FX_ARP
        bne @noarp
        ldy v_arp,x             ; tick 0: the note, then +x, then +y
        beq @arpnext
        lda v_param,x
        dey
        bne @arpy
        lsr
        lsr
        lsr
        lsr
        jmp @arpadd
@arpy:  and #$0f
@arpadd: clc
        adc m_a
        sta m_a
@arpnext: ldy v_arp,x
        iny
        cpy #3
        bcc @arpset
        ldy #0
@arpset: tya
        sta v_arp,x
@noarp: lda m_a
@clamp: cmp #96
        bcc @freq
        cmp #$c0                ; below 0 wrapped round
        lda #95
        bcc @freq
        lda #0
@freq:  tay
        lda freq_lo,y
        sta fr_lo
        lda freq_hi,y
        sta fr_hi
        lda v_fx,x
        cmp #FX_UP
        bcc @addslide
        cmp #FX_VIB
        bcc @slides
        bne @addslide
        jsr vibrato
        jmp @addslide
@slides: ldy tick               ; slides skip the row's first frame, as in IT
        beq @addslide
        cmp #FX_DOWN
        beq @down
        bcs @porta
        lda v_slide_lo,x        ; up, holding at +$7fff (steps are at most $7fff)
        clc
        adc v_step_lo,x
        sta v_slide_lo,x
        lda v_slide_hi,x
        adc v_step_hi,x
        bvc @upok
        lda #$ff
        sta v_slide_lo,x
        lda #$7f
@upok:  sta v_slide_hi,x
        lda #0                  ; a signed slide now
        sta v_uslide,x
        jmp @addslide
@down:  lda #0
        sta v_uslide,x
        jsr slide_down
        jmp @addslide
@porta: lda #1                  ; an unsigned offset until the note changes
        sta v_uslide,x
        jsr portamento
@addslide:
        lda fr_lo
        clc
        adc v_slide_lo,x
        sta fr_lo
        lda fr_hi
        adc v_slide_hi,x
        sta fr_hi
        ldy v_slide_hi,x        ; a slide (signed, within $7fff) stops at the ends of the range
        bmi @neg                ; (ldy leaves the carry of the add alone)
        bcc @inrange
        lda #$ff
        bne @limit
@neg:   bcs @inrange
        lda #0
@limit: ldy v_uslide,x          ; a portamento's offset is unsigned, and it stops at its target,
        bne @inrange            ; also on the rows after it ends
        sta fr_lo
        sta fr_hi
@inrange:
        lda v_fx,x
        beq @still
        cmp #FX_VIB
        bne @store
        lda fr_lo
        clc
        adc v_vib_lo,x
        sta fr_lo
        lda fr_hi
        adc v_vib_hi,x
        sta fr_hi
        jmp @store
@still: lda v_wtpos,x           ; no effect and the wavetable done: hold from now on
        cmp #$ff
        bne @store
        lda #1
        sta v_hold,x
@store: lda fr_lo
        sta v_fr_lo,x
        lda fr_hi
        sta v_fr_hi,x
@pulse: lda v_pw_spd,x           ; ping-pong between the limits the sweep started with
        beq @write
        clc
        bmi @pwdown
        adc v_pw_lo,x
        sta v_pw_lo,x
        lda v_pw_hi,x
        adc #0
        sta v_pw_hi,x
        cmp v_pw_max,x
        bcc @write
        bcs @turn
@pwdown: adc v_pw_lo,x
        sta v_pw_lo,x
        lda v_pw_hi,x
        adc #$ff
        sta v_pw_hi,x
        bmi @turn
        cmp v_pw_min,x
        bcs @write
@turn:  lda v_pw_spd,x
        eor #$ff
        clc
        adc #1
        sta v_pw_spd,x
@write: cpx #2                  ; music voice 2 is silent while an effect has voice 3
        bne @out
        lda sfx_state
        bne @skip
@out:   ldy sid_off,x
        lda mute
        and mute_bit,x
        bne @muted
        lda v_fr_lo,x
        sta SID,y
        lda v_fr_hi,x
        sta SID+1,y
        lda v_pw_lo,x
        sta SID+2,y
        lda v_pw_hi,x
        sta SID+3,y
        lda v_wave,x            ; waveform, then attack/decay, then sustain/release (2.6.1)
        ora v_gate,x
        sta SID+4,y
        lda v_ad,x
        sta SID+5,y
        lda v_sr,x
        sta SID+6,y
@skip:  rts
@muted: lda #$08                ; test bit: silent
        sta SID+4,y
        rts

sid_off: .byte 0, 7, 14, 14
mute_bit: .byte 1, 2, 4, 4

slide_down:                     ; holding at -$7fff for a slide; a portamento stops itself
        lda v_slide_lo,x
        sec
        sbc v_step_lo,x
        sta m_x
        lda v_slide_hi,x
        sbc v_step_hi,x
        bvc @store
        ldy v_uslide,x
        bne @store
        lda #$01
        sta m_x
        lda #$80
@store: sta v_slide_hi,x
        lda m_x
        sta v_slide_lo,x
        rts

; Tone portamento: slide from the base note towards v_target, then make it the base note.
; Frequencies are unsigned: the borrow of target - current gives the direction.
portamento:
        lda fr_lo               ; m = freq[note] + slide, the frequency now
        clc
        adc v_slide_lo,x
        sta m_lo
        lda fr_hi
        adc v_slide_hi,x
        sta m_hi
        ldy v_target,x
        lda freq_lo,y           ; m = target - m, the distance left
        sec
        sbc m_lo
        sta m_lo
        lda freq_hi,y
        sbc m_hi
        sta m_hi
        bcc @below
        lda m_lo                ; target above: done if distance <= step
        cmp v_step_lo,x
        lda m_hi
        sbc v_step_hi,x
        bcc @arrive
        lda v_slide_lo,x
        clc
        adc v_step_lo,x
        sta v_slide_lo,x
        lda v_slide_hi,x
        adc v_step_hi,x
        sta v_slide_hi,x
        rts
@below: lda m_lo                ; target below: done if -distance <= step
        clc
        adc v_step_lo,x
        lda m_hi
        adc v_step_hi,x
        bcs @arrive
        jmp slide_down
@arrive: lda v_target,x
        sta v_note,x
        tay
        lda freq_lo,y
        sta fr_lo
        lda freq_hi,y
        sta fr_hi
        lda #0
        sta v_slide_lo,x
        sta v_slide_hi,x
        rts

; Triangle vibrato: a quarter period up first, then half periods, so it centres on the note
; (music.html, 2.3).
vibrato:
        lda v_vdir,x
        bne @down
        lda v_vib_lo,x
        clc
        adc v_step_lo,x
        sta v_vib_lo,x
        lda v_vib_hi,x
        adc v_step_hi,x
        sta v_vib_hi,x
        jmp @count
@down:  lda v_vib_lo,x
        sec
        sbc v_step_lo,x
        sta v_vib_lo,x
        lda v_vib_hi,x
        sbc v_step_hi,x
        sta v_vib_hi,x
@count: dec v_vcnt,x
        bne @done
        lda v_vhalf,x
        sta v_vcnt,x
        lda v_vdir,x
        eor #1
        sta v_vdir,x
@done:  rts

; ---- sound effects

; A request from sfx: one hard-restart frame on voice 3, then the note (sfx_frame).
sfx_begin:
        ldy sfx_req
        dey
        lda #0
        sta sfx_req
        lda sfx_ins,y
        sta v_ins+3
        lda sfx_note,y
        sta sfx_n
        lda sfx_len,y
        sta sfx_gate
        lda sfx_tail,y
        sta sfx_rest
        lda sfx_state
        bne @hr
        lda v_wave+2            ; taking the voice over: release what music voice 2 had
        sta v_wave+3
@hr:    lda #0
        sta v_gate+3
        sta v_ad+3
        sta v_sr+3
        sta v_fx+3
        lda #$ff
        sta v_wtpos+3
        lda #1
        sta sfx_state
        rts

sfx_frame:
        lda sfx_state
        cmp #1
        bne @run
        inc sfx_state           ; the restart frame is written: start the note
        ldx #3
        lda sfx_n
        jmp start_note
@run:   lda sfx_gate
        beq @tail
        dec sfx_gate
        bne @done
        lda #0
        sta v_gate+3
        rts
@tail:  lda sfx_rest
        beq @end
        dec sfx_rest
        rts
@end:   lda #0                  ; give voice 3 back: silent until music voice 2's next note
        sta sfx_state
        sta v_gate+2
        sta v_wave+2
        lda #$ff
        sta v_wtpos+2
@done:  rts

; ---- filter

filter_frame:
.if FILTERS
        ldy f_owner
        bmi @off
        lda f_spd
        beq @write
        bmi @dec
        clc
        adc f_cut
        bcs @max
        cmp f_max
        bcc @set
@max:   lda f_max
        jmp @set
@dec:   clc
        adc f_cut
        bcc @min                ; went below 0
        cmp f_min
        bcs @set
@min:   lda f_min
@set:   sta f_cut
@write: lda f_cut
        sta SID+$16
        lda mute_bit,y
        cpy #2                  ; no filtering on voice 3 while an effect has it
        bne @route
        ldy sfx_state
        beq @route
        lda #0
@route: ora f_res
        sta SID+$17
        lda f_mode
        ora #VOLUME
        sta SID+$18
        rts
@off:   lda #0
        sta SID+$17
.endif
        lda #VOLUME
        sta SID+$18
        rts

; ---- state (cleared by init; arrays are per voice, voice 3 = sound effect)

vars:
v_note: .res 4
v_ins: .res 4
v_gate: .res 4
v_wave: .res 4
v_wtpos: .res 4
v_wtnote: .res 4
v_pw_lo: .res 4
v_pw_hi: .res 4
v_pw_spd: .res 4
v_pw_min: .res 4
v_pw_max: .res 4
v_ad: .res 4
v_sr: .res 4
v_slide_lo: .res 4
v_slide_hi: .res 4
v_uslide: .res 4                ; 1: the slide offset is a portamento's (unsigned)
v_fx: .res 4
v_param: .res 4
v_step_lo: .res 4
v_step_hi: .res 4
v_vib_lo: .res 4
v_vib_hi: .res 4
v_vcnt: .res 4
v_vhalf: .res 4
v_vdir: .res 4
v_target: .res 4
v_arp: .res 4
v_trk_lo: .res 4
v_trk_hi: .res 4
v_wait: .res 4
p_note: .res 4
p_ins: .res 4
p_vol: .res 4
p_fx: .res 4
p_p1: .res 4
p_p2: .res 4
p_p3: .res 4
v_hold: .res 4
v_fr_lo: .res 4
v_fr_hi: .res 4
tick: .res 1
speed: .res 1
speed_even: .res 1
speed_odd: .res 1
ftick: .res 1
f_order: .res 1
f_row: .res 1
f_rows: .res 1
p_order: .res 1
p_row: .res 1
jump: .res 1
last_fx: .res 1
sfx_req: .res 1
sfx_state: .res 1
sfx_n: .res 1
sfx_gate: .res 1
sfx_rest: .res 1
f_owner: .res 1
f_cut: .res 1
f_spd: .res 1
f_min: .res 1
f_max: .res 1
f_res: .res 1
f_mode: .res 1
fr_lo: .res 1
fr_hi: .res 1
m_lo: .res 1
m_hi: .res 1
m_x: .res 1
m_a: .res 1
r0: .res 1
r1: .res 1
r2: .res 1
vars_end:
        .assert vars_end - vars <= 256, "init clears at most 256 bytes of variables"
