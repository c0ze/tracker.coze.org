; cozy-tracker SID driver: entry points, sequencer, row decode and apply. See sid/FORMAT.md.
; The per-frame voice code is in sid/voice.s; song data and these constants come from
; tools/sid-compile.js: ORG, SPEED, SPEED_ODD, NUM_ORDERS, LOOP_ORDER, HR_FRAMES, HR_AD, HR_SR, HR_KEEP
; (0/1: leave the ADSR alone in the restart), VOLUME, FILTERS (0/1).

SID = $d400

FX_ARP = 1
FX_UP = 2
FX_DOWN = 3
FX_PORTA = 4
FX_VIB = 5
FX_SPEED = 6
FX_JUMP = 7

NO_NOTE = $fe           ; p_note: nothing on this row

; Rows are fetched this many frames ahead, so a hard restart has HR_FRAMES frames.
.if HR_FRAMES
FETCH_AHEAD = HR_FRAMES
.else
FETCH_AHEAD = 1
.endif

        .org ORG
        jmp init
        jmp play
        jmp sfx
start_order: .byte 0
mute:   .byte 0
cur_order: .byte 0
cur_row: .byte 0
restart: .byte 0                ; host: order + 1 to restart there on the next play

; The entry points clear decimal mode: an IRQ does not, and the code below adds and subtracts.
; A = effect number. Only stores the request; play starts it.
sfx:    cld
        clc
        adc #1
        sta sfx_req
        rts

init:   cld
        lda #0
        ldx #0
@clr:   sta vars,x
        inx
        cpx #<(vars_end - vars)
        bne @clr
        ldx #$18
@sid:   sta SID,x
        dex
        bpl @sid
        ldx #3
@voice: lda #$ff
        sta v_wtpos,x
        sta p_ins,x
        sta p_vol,x
        lda #NO_NOTE
        sta p_note,x
        dex
        bpl @voice
        lda #$ff
        sta jump
        sta f_owner
        lda #SPEED
        sta speed
        sta speed_even
        lda #SPEED_ODD
        sta speed_odd
        jsr set_fetch_tick
        lda #SPEED - 1
        sta tick                ; the first play wraps to tick 0 and applies the first row
        ldx start_order
        jsr load_order
        jmp fetch_voices

play:   cld
        lda restart                 ; a section change from the host (one byte: no race)
        beq @run
        sec
        sbc #1
        sta start_order
        lda #0
        sta restart
        lda sfx_req                 ; an effect asked for with the restart still plays
        pha
        jsr init
        pla
        sta sfx_req
@run:   ldx tick
        inx
        cpx speed
        bcc @tick
        ldx #0
@tick:  stx tick
        txa
        bne @fetch
        jsr apply_row
@fetch: lda ftick
        cmp tick
        bne @sfx
        jsr fetch_row
@sfx:   lda sfx_req
        beq @voices
        jsr sfx_begin
@voices: ldx #0
        jsr voice_frame
        ldx #1
        jsr voice_frame
        ldx #2
        jsr voice_frame
        lda sfx_state
        beq @filter
        ldx #3
        jsr voice_frame
        jsr sfx_frame
@filter: jmp filter_frame

; ---- sequencer

fetch_row:
        ldx jump                ; $ff: none (the order list holds at most 255)
        cpx #$ff
        beq @next
        lda #$ff
        sta jump
        jmp @load
@next:  inc f_row
        lda f_row
        cmp f_rows
        bcc fetch_voices
        ldx f_order
        inx
        cpx #NUM_ORDERS
        bcc @load
        ldx #LOOP_ORDER
@load:  jsr load_order
fetch_voices:
        lda f_order
        sta p_order
        lda f_row
        sta p_row
        ldx #2
@voice: jsr decode
        dex
        bpl @voice
        rts

; X = order position: the pattern's length and its three tracks.
load_order:
        stx f_order
        ldy order_pat,x
        lda pat_rows,y
        sta f_rows
        lda #0
        sta f_row
        sta v_wait
        sta v_wait+1
        sta v_wait+2
        ldx pat_v0,y
        lda trk_lo,x
        sta v_trk_lo
        lda trk_hi,x
        sta v_trk_hi
        ldx pat_v1,y
        lda trk_lo,x
        sta v_trk_lo+1
        lda trk_hi,x
        sta v_trk_hi+1
        ldx pat_v2,y
        lda trk_lo,x
        sta v_trk_lo+2
        lda trk_hi,x
        sta v_trk_hi+2
        rts

; X = voice: decode one row into p_note/p_ins/p_vol/p_fx/p_p1-3. The track is read through
; rdb, whose address is set once per voice; Y counts the bytes.
decode: lda #NO_NOTE
        sta p_note,x
        lda #$ff
        sta p_ins,x
        sta p_vol,x
        lda #0
        sta p_fx,x
        lda v_wait,x
        beq @start
        dec v_wait,x
        rts
@start: lda v_trk_lo,x
        sta rdb+1
        lda v_trk_hi,x
        sta rdb+2
        ldy #0
@read:  jsr rdb
        cmp #$60
        bcc @note
        cmp #$62
        bcc @stop
        cmp #$80
        bcc @rest
        cmp #$a0
        bcc @ins
        cmp #$b0
        bcc @vol
        and #$0f                ; effect: 1 parameter byte, 2 for slides and speed, 3 for vibrato
        sta p_fx,x
        jsr rdb
        sta p_p1,x
        lda p_fx,x
        cmp #FX_UP
        bcc @read
        cmp #FX_JUMP
        bcs @read
        jsr rdb
        sta p_p2,x
        lda p_fx,x
        cmp #FX_VIB
        bne @read
        jsr rdb
        sta p_p3,x
        jmp @read
@ins:   and #$1f
        sta p_ins,x
        jmp @read
@vol:   and #$0f
        sta p_vol,x
        jmp @read
@rest:  sec
        sbc #$62
        sta v_wait,x
        jmp @end
@stop:  sta p_note,x            ; $60 key off, $61 cut
        jmp @end
@note:  sta p_note,x
        lda p_fx,x
        cmp #FX_PORTA
        beq @end
.if HR_FRAMES
        lda #0                  ; hard restart (music.html, 2.6.1)
        sta v_gate,x
.if HR_KEEP == 0
        lda #HR_AD
        sta v_ad,x
        lda #HR_SR
        sta v_sr,x
.endif
.endif
@end:   tya
        clc
        adc v_trk_lo,x
        sta v_trk_lo,x
        bcc @done
        inc v_trk_hi,x
@done:  rts

rdb:    lda $ffff,y             ; self-modified: the driver runs from RAM
        iny
        rts

; ---- row apply (tick 0)

apply_row:
        lda p_order
        sta cur_order
        lda p_row
        sta cur_row
        ldx #2
@voice: jsr apply_voice
        dex
        bpl @voice
        lda p_row               ; this row's length: even or odd row (funktempo)
        lsr
        lda speed_even
        bcc @even
        lda speed_odd
@even:  cmp speed
        beq @same
        sta speed
        jmp set_fetch_tick
@same:  rts

apply_voice:
        lda p_note,x            ; an empty row with no effect starting, going on or ending:
        cmp #NO_NOTE            ; nothing changes (and a held voice stays held)
        bne @apply
        lda p_fx,x
        ora v_fx,x
        bne @apply
        lda p_ins,x
        bpl @apply
        rts
@apply: lda p_ins,x
        bmi @fx
        sta v_ins,x
@fx:    lda v_fx,x
        sta last_fx
        lda p_fx,x
        sta v_fx,x
        lda p_p1,x
        sta v_param,x
        sta v_step_lo,x
        lda p_p2,x
        sta v_step_hi,x
        lda p_note,x
        cmp #$60
        bcc @note
        bne @cut
        lda #0                  ; key off
        sta v_gate,x
        jmp effect_setup
@cut:   cmp #$61
        bne effect_setup
        lda #0
        sta v_gate,x
        sta v_ad,x
        sta v_sr,x
        jmp effect_setup
@note:  ldy v_fx,x
        cpy #FX_PORTA
        bne @start
        sta v_target,x          ; legato: slide there, no restart
        jmp effect_setup
@start: jsr start_note
        ; falls through

; X = voice: per-row effect state. Slide and vibrato steps come precomputed from the
; compiler (the semitone's width at the note, music.html 1.2), so there is no multiply here.
effect_setup:
        lda #0
        sta v_hold,x
        lda v_fx,x
        cmp #FX_ARP
        bne @vib
        lda #0
        sta v_arp,x
        rts
@vib:   cmp #FX_VIB
        bne @speed
        lda p_p3,x              ; quarter period in frames; bit 7: the compiler saw it change
        bmi @new
        ldy last_fx
        cpy #FX_VIB
        beq @done               ; continuing vibrato keeps its phase
@new:   and #$7f
        sta v_vcnt,x
        asl
        sta v_vhalf,x
        lda #0
        sta v_vib_lo,x
        sta v_vib_hi,x
        sta v_vdir,x
@done:  rts
@speed: cmp #FX_SPEED
        bne @jump
        lda v_param,x           ; even rows, odd rows (apply_row picks)
        sta speed_even
        lda v_step_hi,x
        sta speed_odd
        rts
@jump:  cmp #FX_JUMP
        bne @done
        lda v_param,x
        sta jump
        rts

; Rows are fetched on tick max(1, speed - FETCH_AHEAD).
set_fetch_tick:
        lda speed
        sec
        sbc #FETCH_AHEAD
        beq @one
        bcs @set
@one:   lda #1
@set:   sta ftick
        rts
