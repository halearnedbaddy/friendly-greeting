-- Enable realtime for the transactions table so sellers get instant order notifications
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;