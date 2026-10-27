// cRSID as a WebAssembly module, for the SID player (player/sid-player.js) and the tests.
// Build: tools/build-crsid.sh (clang --target=wasm32, no libc). Exports are prefixed crsid_.
#include "../libcRSID.c"

#define EXPORT(name) __attribute__((export_name(#name)))

// clang may call these for struct copies and clears; there is no libc.
void *memset(void *d, int c, unsigned long n) { unsigned char *p = d; while (n--) *p++ = (unsigned char)c; return d; }
void *memcpy(void *d, const void *s, unsigned long n)
{
	unsigned char *p = d; const unsigned char *q = s;
	while (n--) *p++ = *q++;
	return d;
}

enum { FILE_MAX = 0x7C + 2 + 0x10000, OUT_MAX = 4096 };
static unsigned char file[FILE_MAX];
static short out[OUT_MAX];
static cRSID_C64instance *c64;

// Where the host writes the .sid file before crsid_load.
EXPORT(crsid_file) unsigned char *crsid_file(void) { return file; }
EXPORT(crsid_file_max) int crsid_file_max(void) { return FILE_MAX; }

EXPORT(crsid_init) int crsid_init(int samplerate)
{
	c64 = cRSID_init((unsigned short)samplerate, 0);
	return c64 != 0;
}

// Loads the .sid in crsid_file() and runs its init routine for `subtune` (1-based). 0 on success.
EXPORT(crsid_load) int crsid_load(int size, int subtune)
{
	cRSID_SIDheader *h = cRSID_processSIDfile(c64, file, size);
	if (!h)
		return -1;
	cRSID_initSIDtune(c64, h, (char)subtune);
	return 0;
}

// Renders n mono 16-bit samples (n <= OUT_MAX); returns the buffer.
EXPORT(crsid_render) short *crsid_render(int n)
{
	for (int i = 0; i < n && i < OUT_MAX; i++)
		out[i] = cRSID_generateSample(c64);
	return out;
}

// Runs the loaded tune's init routine again on the RAM as it is now (after crsid_poke), with
// the C64 reset but the file not reloaded: the player uses it to start from an order.
EXPORT(crsid_restart) void crsid_restart(void) { cRSID_initSIDtune(c64, c64->SIDheader, 1); }

// Voice v's envelope level (0-255), for level meters.
EXPORT(crsid_env) int crsid_env(int v) { return c64->SID[1].EnvelopeCounter[(v % 3) * 7]; }

// 6581 or 8580, overriding the file's header.
EXPORT(crsid_set_model) void crsid_set_model(int model) { c64->SID[1].ChipModel = (unsigned short)model; }

EXPORT(crsid_peek) int crsid_peek(int addr) { return c64->RAMbank[addr & 0xFFFF]; }
EXPORT(crsid_poke) void crsid_poke(int addr, int v) { c64->RAMbank[addr & 0xFFFF] = (unsigned char)v; }
// The last value written to SID register r ($D400 + r).
EXPORT(crsid_sid) int crsid_sid(int r) { return c64->IObankWR[0xD400 + (r & 0x1F)]; }

// For tests: runs the subroutine at addr with A = a until it returns, without advancing the
// sound. Returns its CPU cycles, or -1 if it runs past `limit` cycles.
EXPORT(crsid_call) int crsid_call(int addr, int a, int limit)
{
	int cycles = 0;
	cRSID_initCPU(&c64->CPU, (unsigned short)addr);
	c64->CPU.A = a & 0xFF;
	for (;;) {
		unsigned char c = cRSID_emulateCPU();
		if (c >= 0xFE)
			return cycles + 6; // the final RTS
		cycles += c;
		if (cycles > limit)
			return -1;
	}
}
