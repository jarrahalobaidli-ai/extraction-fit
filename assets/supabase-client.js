// Shared Supabase client for extraction.fit.
// The anon/publishable key below is safe to ship client-side — every table it can
// touch is protected by row-level security policies on the Supabase project.
(function () {
  var SUPABASE_URL = "https://nhypmosbyqngfbiwxoow.supabase.co";
  var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oeXBtb3NieXFuZ2ZiaXd4b293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0Nzk4NTYsImV4cCI6MjEwNDA1NTg1Nn0.aeYp6pKlZCtFXxNYKY4llLz02sYM9UUXzDP6zwqEt4A";
  if (window.supabase && window.supabase.createClient) {
    window.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error("Supabase JS library did not load — check the CDN script tag.");
  }
})();
