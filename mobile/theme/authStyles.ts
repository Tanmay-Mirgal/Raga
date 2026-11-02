import { StyleSheet } from 'react-native';
import { colors, radius, shadow, type } from './index';

/** Shared look for the sign-in and sign-up screens. */
export const authStyles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 380 },

  headerContainer: { alignItems: 'center', marginBottom: 36 },
  logoWrapper: {
    width: 84,
    height: 84,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 18,
    ...shadow.card,
  },
  logo: { width: 52, height: 52 },
  title: { ...type.display, color: colors.text },
  subtitle: { color: colors.textMuted, fontSize: 15, marginTop: 6 },

  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
  },
  inputLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' },
  input: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 16,
    color: colors.text,
    fontSize: 15,
    marginBottom: 18,
  },
  inputFocused: { borderColor: colors.accent, backgroundColor: colors.surfaceHigh },
  helperText: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },

  signInButton: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  signInButtonText: { color: '#04120A', fontSize: 16, fontWeight: '800' },
  signUpButton: {
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  signUpButtonText: { color: '#04120A', fontSize: 16, fontWeight: '800' },

  dividerContainer: { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textFaint, marginHorizontal: 12, fontSize: 12, fontWeight: '600' },

  googleButton: {
    height: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonContent: { flexDirection: 'row', alignItems: 'center' },
  googleIcon: { marginRight: 10 },
  googleButtonText: { color: colors.text, fontSize: 15, fontWeight: '700' },

  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 24, gap: 6 },
  footerText: { color: colors.textMuted, fontSize: 14 },
  link: { color: colors.accent, fontSize: 14, fontWeight: '800' },
});
