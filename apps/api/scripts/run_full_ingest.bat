@echo off
cd /d E:\smn\apps\api
set PYTHONUNBUFFERED=1
"E:\smn\apps\api\.venv\Scripts\python.exe" -u -m scripts.ingest_transcripts --incremental >> "E:\smn\docs\ingestion-reports\full-ingest-stdout.log" 2>> "E:\smn\docs\ingestion-reports\full-ingest-stderr.log"
