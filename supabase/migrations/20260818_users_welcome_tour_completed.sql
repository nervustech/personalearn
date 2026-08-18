-- PSL-107: persist dashboard welcome-tour completion on the teacher profile.
-- localStorage alone replays the first-timer tour on a new browser / incognito.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS welcome_tour_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.welcome_tour_completed_at IS
  'Set when the teacher finishes or skips the dashboard welcome tour.';

-- Returning teachers already have a class; mark them complete so a new device
-- does not replay first-timer onboarding. New teachers keep NULL until they
-- dismiss the tour after creating their first class.
UPDATE public.users AS u
SET
  welcome_tour_completed_at = NOW(),
  updated_at = NOW()
WHERE u.welcome_tour_completed_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.classes AS c
    WHERE c.teacher_id = u.id
      AND COALESCE(c.is_active, true)
  );
